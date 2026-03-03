import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { PayoutStatus, UserRole } from '@prisma/client';
import {
  PLATFORM_FEE_RATE,
  MP_FEE_ESTIMATE_RATE,
} from '../common/constants/fees.constants';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly PAYOUT_DELAY_DAYS = 7; // Days after delivery confirmation to release payment

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private audit: AuditService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
  ) {}

  /**
   * Create a payout record when a raffle is completed (all tickets sold and drawn)
   */
  async createPayout(raffleId: string) {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: {
        tickets: { where: { estado: 'PAGADO' } },
        payout: true,
      },
    });

    if (!raffle) {
      throw new NotFoundException('Rifa no encontrada');
    }

    if (raffle.payout) {
      this.logger.warn(`Payout already exists for raffle ${raffleId}`);
      return raffle.payout;
    }

    // Calculate amounts
    const grossAmount = raffle.tickets.reduce(
      (sum, t) => sum + Number(t.precioPagado),
      0,
    );
    const platformFee = grossAmount * PLATFORM_FEE_RATE;
    const processingFee = grossAmount * MP_FEE_ESTIMATE_RATE;
    const netAmount = grossAmount - platformFee - processingFee;

    const payout = await this.prisma.payout.create({
      data: {
        raffleId,
        sellerId: raffle.sellerId,
        grossAmount,
        platformFee,
        processingFee,
        netAmount,
        status: PayoutStatus.PENDING,
      },
    });

    this.logger.log(`Payout created for raffle ${raffleId}: $${netAmount} net`);
    return payout;
  }

  /**
   * Schedule payout after delivery is confirmed
   */
  async schedulePayoutAfterDelivery(raffleId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { raffleId },
    });

    if (!payout) {
      // Create payout if it doesn't exist
      await this.createPayout(raffleId);
    }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + this.PAYOUT_DELAY_DAYS);

    const updated = await this.prisma.payout.update({
      where: { raffleId },
      data: { scheduledFor },
    });

    this.logger.log(
      `Payout scheduled for ${scheduledFor.toISOString()} for raffle ${raffleId}`,
    );

    // Notify seller
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { sellerId: true, titulo: true },
    });

    if (raffle) {
      await this.notifications.create(
        raffle.sellerId,
        'INFO',
        'Pago programado',
        `Tu pago por "${raffle.titulo}" sera procesado el ${scheduledFor.toLocaleDateString('es-AR')}`,
      );
    }

    return updated;
  }

  /**
   * Process pending payouts that are due
   * This should be called by a cron job
   */
  async processDuePayouts() {
    const duePayouts = await this.prisma.payout.findMany({
      where: {
        status: PayoutStatus.PENDING,
        scheduledFor: { lte: new Date() },
      },
      include: {
        raffle: {
          select: { sellerId: true, titulo: true, deliveryStatus: true },
        },
      },
    });

    this.logger.log(`Processing ${duePayouts.length} due payouts`);

    for (const payout of duePayouts) {
      try {
        // Only process if delivery is confirmed
        if (payout.raffle.deliveryStatus !== 'CONFIRMED') {
          this.logger.warn(
            `Skipping payout ${payout.id}: delivery not confirmed`,
          );
          continue;
        }

        await this.processPayout(payout.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to process payout ${payout.id}: ${message}`);
      }
    }
  }

  /**
   * Immediately process payout for a specific raffle once release conditions are met.
   * Used when delivery is explicitly confirmed or auto-confirmed by policy.
   */
  async processPayoutForRaffle(raffleId: string) {
    let payout = await this.prisma.payout.findUnique({
      where: { raffleId },
    });

    if (!payout) {
      payout = await this.createPayout(raffleId);
    }

    if (payout.status === PayoutStatus.COMPLETED) {
      return payout;
    }

    if (payout.status === PayoutStatus.PROCESSING) {
      throw new BadRequestException('El payout ya está en proceso');
    }

    if (payout.status === PayoutStatus.FAILED) {
      payout = await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.PENDING,
          failureReason: null,
        },
      });
    }

    await this.prisma.payout.update({
      where: { id: payout.id },
      data: { scheduledFor: new Date() },
    });

    await this.processPayout(payout.id);

    const updated = await this.prisma.payout.findUnique({
      where: { id: payout.id },
    });

    if (!updated) {
      throw new NotFoundException('Payout no encontrado');
    }

    return updated;
  }

  /**
   * Process a single payout via Mercado Pago
   */
  async processPayout(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        raffle: {
          include: {
            seller: {
              select: {
                id: true,
                mpUserId: true,
                mpAccessToken: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout no encontrado');
    }

    if (payout.status !== PayoutStatus.PENDING) {
      throw new BadRequestException(
        `Payout ya esta en estado ${payout.status}`,
      );
    }

    const releaseCheck = await this.paymentsService.canReleaseFunds(
      payout.raffleId,
    );
    if (!releaseCheck.canRelease) {
      throw new BadRequestException(releaseCheck.reason);
    }

    // Mark as processing
    await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PROCESSING },
    });

    try {
      // Check if seller has MP connected
      if (
        !payout.raffle.seller.mpUserId ||
        !payout.raffle.seller.mpAccessToken
      ) {
        throw new Error('Vendedor no tiene Mercado Pago conectado');
      }

      // Release held funds via MP API (delayed disbursement)
      const releaseResult = await this.paymentsService.releaseFundsToSeller(
        payout.raffleId,
      );

      if (!releaseResult.success && releaseResult.releasedPayments === 0) {
        throw new Error(
          `No se pudieron liberar los fondos: ${releaseResult.errors.join(', ')}`,
        );
      }

      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.COMPLETED,
          processedAt: new Date(),
          mpPayoutId: `release_${Date.now()}`,
        },
      });

      // Update raffle
      await this.prisma.raffle.update({
        where: { id: payout.raffleId },
        data: {
          paymentReleasedAt: new Date(),
          estado: 'FINALIZADA',
        },
      });

      // Notify seller
      await this.notifications.create(
        payout.raffle.seller.id,
        'INFO',
        'Pago completado',
        `Tu pago de $${payout.netAmount} por "${payout.raffle.titulo}" ha sido procesado`,
      );

      this.logger.log(`Payout ${payoutId} completed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.FAILED,
          failureReason: message,
        },
      });

      // Notify seller of failure
      await this.notifications.create(
        payout.raffle.seller.id,
        'SYSTEM',
        'Error en pago',
        `Hubo un problema procesando tu pago por "${payout.raffle.titulo}". Contacta soporte.`,
      );

      this.logger.error(`Payout ${payoutId} failed: ${message}`);
      throw error;
    }
  }

  /**
   * Manually release payout (admin action)
   */
  async releasePayoutManually(
    adminId: string,
    payoutId: string,
    reason: string,
  ) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { raffle: { select: { titulo: true } } },
    });

    if (!payout) {
      throw new NotFoundException('Payout no encontrado');
    }

    await this.processPayout(payoutId);

    // Log admin action
    await this.audit.logPayoutReleased(adminId, payoutId, {
      reason,
      amount: Number(payout.netAmount),
      raffleTitulo: payout.raffle.titulo,
    });

    return true;
  }

  /**
   * Get payout by raffle ID
   */
  async getPayoutByRaffle(raffleId: string) {
    return this.prisma.payout.findUnique({
      where: { raffleId },
      include: {
        raffle: { select: { titulo: true, sellerId: true } },
      },
    });
  }

  async getPayoutByRaffleForUser(
    raffleId: string,
    requesterId: string,
    requesterRole: UserRole,
  ) {
    const payout = await this.getPayoutByRaffle(raffleId);

    if (!payout) {
      return null;
    }

    if (requesterRole !== UserRole.ADMIN && payout.sellerId !== requesterId) {
      throw new ForbiddenException('No tienes permisos para ver este payout');
    }

    return payout;
  }

  /**
   * Get all payouts for a seller
   */
  async getSellerPayouts(sellerId: string) {
    const payouts = await this.prisma.payout.findMany({
      where: { sellerId },
      include: {
        raffle: { select: { titulo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payouts.map((p) => ({
      ...p,
      raffleTitulo: p.raffle.titulo,
    }));
  }

  /**
   * Get pending payouts (admin)
   */
  async getPendingPayouts() {
    return this.prisma.payout.findMany({
      where: { status: PayoutStatus.PENDING },
      include: {
        raffle: {
          select: { titulo: true, deliveryStatus: true },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }
}
