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
import { ActivityService } from '../activity/activity.service';
import { PaymentsService } from '../payments/payments.service';
import {
  PayoutStatus,
  Prisma,
  UserRole,
  WalletLedgerEntryType,
} from '@prisma/client';
import { captureException } from '../sentry';
import { WalletService } from '../wallet/wallet.service';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoSellerProvider,
  MercadoPagoSellerPayoutResult,
} from '../payments/providers/mercado-pago-seller.provider';

interface PayoutProcessingContext {
  id: string;
  raffleId: string;
  sellerId: string;
  netAmount: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  processingFee: Prisma.Decimal;
  raffle: {
    titulo: string;
    seller: {
      id: string;
      email: string;
    };
  };
}

/**
 * Creates, schedules, and processes seller payouts once raffle delivery and release rules are satisfied.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private readonly PAYOUT_DELAY_DAYS = 7; // Days after delivery confirmation to release payment
  private readonly paymentsProvider: 'mercado_pago' | 'mock';

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private activity: ActivityService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
    private walletService: WalletService,
    private configService: ConfigService,
    private mercadoPagoSellerProvider: MercadoPagoSellerProvider,
  ) {
    const explicitProvider = (
      this.configService.get<string>('PAYMENTS_PROVIDER') || ''
    )
      .trim()
      .toLowerCase();
    this.paymentsProvider =
      explicitProvider === 'mock' ? 'mock' : 'mercado_pago';
  }

  /**
   * Creates the payout record for a raffle once the paid-ticket totals are known.
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
    const subsidyAggregate = await this.prisma.transaction.aggregate({
      where: {
        raffleId,
        tipo: {
          in: ['SUBSIDIO_PROMOCIONAL_PLATAFORMA', 'SUBSIDIO_PACK_PLATAFORMA'],
        },
        estado: 'COMPLETADO',
        isDeleted: false,
      },
      _sum: { monto: true },
    });
    const platformSubsidyAmount = Number(subsidyAggregate._sum.monto ?? 0);
    const { platformFee, processingFee, netAmount } =
      this.paymentsService.calculateCommissions(grossAmount);

    const payout = await this.prisma.payout.create({
      data: {
        raffleId,
        sellerId: raffle.sellerId,
        grossAmount,
        platformSubsidyAmount,
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
   * Schedules a payout after delivery confirmation and notifies the seller.
   */
  async schedulePayoutAfterDelivery(raffleId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { raffleId },
    });

    if (!payout) {
      // Create payout if it doesn't exist
      await this.createPayout(raffleId);
    }

    const raffleForSchedule = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { confirmedAt: true },
    });
    const scheduledFor = new Date(
      raffleForSchedule?.confirmedAt?.getTime() ?? Date.now(),
    );
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
      select: {
        sellerId: true,
        titulo: true,
        seller: { select: { email: true } },
      },
    });

    if (raffle) {
      await this.notifyPayoutScheduled({
        sellerId: raffle.sellerId,
        sellerEmail: raffle.seller.email,
        raffleTitle: raffle.titulo,
        payoutId: updated.id,
        scheduledFor,
      });
      await this.activity.logPayoutScheduled(
        raffle.sellerId,
        updated.id,
        scheduledFor,
      );
    }

    return updated;
  }

  /**
   * Processes every pending payout whose scheduled date has already arrived.
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
   * Forces the payout for a raffle into immediate processing once release conditions are met.
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
   * Processes a single payout, updates raffle state, and notifies the seller of the outcome.
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
                email: true,
                sellerPaymentAccount: {
                  select: {
                    id: true,
                    provider: true,
                    status: true,
                    providerAccountId: true,
                    providerEmail: true,
                  },
                },
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
      const sellerPaymentAccount = payout.raffle.seller.sellerPaymentAccount;
      if (
        !sellerPaymentAccount ||
        sellerPaymentAccount.status !== 'CONNECTED' ||
        !sellerPaymentAccount.providerAccountId
      ) {
        throw new Error('El vendedor no tiene Mercado Pago conectado');
      }

      await this.assertSellerPayableCoversPayout(
        payout.raffle.seller.id,
        Number(payout.netAmount),
      );

      const providerResult = await this.createProviderPayout({
        payoutId,
        raffleTitle: payout.raffle.titulo,
        sellerProviderAccountId: sellerPaymentAccount.providerAccountId,
        sellerProviderEmail: sellerPaymentAccount.providerEmail,
        amount: Number(payout.netAmount),
      });

      if (providerResult.providerStatus === 'failed') {
        throw new Error(
          providerResult.providerStatusDetail ||
            'Mercado Pago rechazó la liquidación',
        );
      }

      await this.recordAcceptedProviderPayout(payout, providerResult);

      if (providerResult.providerStatus === 'completed') {
        await this.completeAcceptedPayout(payout, providerResult);

        await this.notifyPayoutCompleted({
          sellerId: payout.raffle.seller.id,
          sellerEmail: payout.raffle.seller.email,
          raffleTitle: payout.raffle.titulo,
          netAmount: Number(payout.netAmount),
          fees: Number(payout.platformFee) + Number(payout.processingFee),
        });
        await this.activity.logPayoutReleased(
          payout.raffle.seller.id,
          payoutId,
          Number(payout.netAmount),
        );

        this.logger.log(`Payout ${payoutId} processed successfully`);
      } else {
        await this.prisma.payout.update({
          where: { id: payoutId },
          data: {
            status: PayoutStatus.PROCESSING,
            providerPayoutId: providerResult.providerPayoutId,
            providerPayoutStatus: providerResult.providerStatus,
            providerPayoutStatusDetail: providerResult.providerStatusDetail,
            providerMetadata: this.toProviderMetadata(providerResult),
          },
        });
        this.logger.log(`Payout ${payoutId} is processing in Mercado Pago`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      const debitAlreadyRecorded = await this.hasSellerPayableDebit(payoutId);
      if (debitAlreadyRecorded) {
        await this.walletService.creditSellerPayable(
          this.prisma,
          payout.raffle.seller.id,
          Number(payout.netAmount),
          {
            raffleId: payout.raffleId,
            payoutId,
            metadata: {
              reason: 'payout_failed_reversal',
            },
          },
        );
      }

      await this.prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.FAILED,
          failureReason: message,
        },
      });

      await this.notifyPayoutFailed({
        sellerId: payout.raffle.seller.id,
        sellerEmail: payout.raffle.seller.email,
        raffleTitle: payout.raffle.titulo,
        payoutId,
        netAmount: Number(payout.netAmount),
        reason: message,
      });
      await this.activity.logPayoutFailed(
        payout.raffle.seller.id,
        payoutId,
        message,
        { raffleId: payout.raffleId },
      );

      this.logger.error(`Payout ${payoutId} failed: ${message}`);
      captureException(
        error instanceof Error ? error : new Error('Payout processing failed'),
        {
          user: {
            id: payout.raffle.seller.id,
            email: payout.raffle.seller.email,
          },
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'payout',
            payoutId,
            raffleId: payout.raffleId,
          },
          extra: {
            payoutId,
            raffleId: payout.raffleId,
            sellerId: payout.raffle.seller.id,
          },
        },
      );
      throw error;
    }
  }

  /**
   * Lets an admin trigger payout processing manually and records the audit trail.
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

  async syncProviderPayoutStatus(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        raffle: {
          include: {
            seller: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout no encontrado');
    }

    if (payout.status !== PayoutStatus.PROCESSING) {
      return payout;
    }

    if (!payout.providerPayoutId) {
      throw new BadRequestException('El payout no tiene id de Mercado Pago');
    }

    const providerResult =
      this.paymentsProvider === 'mock'
        ? this.createMockProviderPayoutResult(payout.id, 'completed')
        : await this.mercadoPagoSellerProvider.getSellerPayoutStatus(
            payout.providerPayoutId,
          );

    if (providerResult.providerStatus === 'processing') {
      return this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          providerPayoutStatus: providerResult.providerStatus,
          providerPayoutStatusDetail: providerResult.providerStatusDetail,
          providerMetadata: this.toProviderMetadata(providerResult),
        },
      });
    }

    if (providerResult.providerStatus === 'completed') {
      await this.completeAcceptedPayout(payout, providerResult);
      return this.prisma.payout.findUnique({ where: { id: payout.id } });
    }

    await this.walletService.creditSellerPayable(
      this.prisma,
      payout.raffle.seller.id,
      Number(payout.netAmount),
      {
        raffleId: payout.raffleId,
        payoutId,
        metadata: { reason: 'payout_failed_reversal' },
      },
    );

    return this.prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.FAILED,
        failureReason:
          providerResult.providerStatusDetail ||
          'Mercado Pago rechazó la liquidación',
        providerPayoutStatus: providerResult.providerStatus,
        providerPayoutStatusDetail: providerResult.providerStatusDetail,
        providerMetadata: this.toProviderMetadata(providerResult),
      },
    });
  }

  private async createProviderPayout(input: {
    payoutId: string;
    raffleTitle: string;
    sellerProviderAccountId: string;
    sellerProviderEmail?: string | null;
    amount: number;
  }): Promise<MercadoPagoSellerPayoutResult> {
    if (this.paymentsProvider === 'mock') {
      return this.createMockProviderPayoutResult(input.payoutId, 'completed');
    }

    return this.mercadoPagoSellerProvider.createSellerPayout({
      payoutId: input.payoutId,
      sellerProviderAccountId: input.sellerProviderAccountId,
      sellerProviderEmail: input.sellerProviderEmail,
      amount: input.amount,
      description: `Liquidación LUK - ${input.raffleTitle}`,
    });
  }

  private createMockProviderPayoutResult(
    payoutId: string,
    status: 'processing' | 'completed' | 'failed',
  ): MercadoPagoSellerPayoutResult {
    return {
      providerPayoutId: `mock_payout_${payoutId}`,
      providerStatus: status,
      providerStatusDetail: 'mock_payout',
      metadata: {
        payoutId,
        transactionId: `mock_payout_tx_${payoutId}`,
      },
    };
  }

  private async recordAcceptedProviderPayout(
    payout: PayoutProcessingContext,
    providerResult: MercadoPagoSellerPayoutResult,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.walletService.debitSellerPayable(
        tx,
        payout.raffle.seller.id,
        Number(payout.netAmount),
        {
          raffleId: payout.raffleId,
          payoutId: payout.id,
          metadata: {
            settlement: 'mercado_pago_payout',
            providerPayoutId: providerResult.providerPayoutId,
          },
        },
      );

      await tx.payout.update({
        where: { id: payout.id },
        data: {
          providerPayoutId: providerResult.providerPayoutId,
          providerPayoutStatus: providerResult.providerStatus,
          providerPayoutStatusDetail: providerResult.providerStatusDetail,
          providerMetadata: this.toProviderMetadata(providerResult),
        },
      });
    });
  }

  private async completeAcceptedPayout(
    payout: PayoutProcessingContext,
    providerResult: MercadoPagoSellerPayoutResult,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.COMPLETED,
          processedAt: new Date(),
          failureReason: null,
          providerPayoutId: providerResult.providerPayoutId,
          providerPayoutStatus: providerResult.providerStatus,
          providerPayoutStatusDetail: providerResult.providerStatusDetail,
          providerMetadata: this.toProviderMetadata(providerResult),
        },
      });

      await tx.raffle.update({
        where: { id: payout.raffleId },
        data: {
          paymentReleasedAt: new Date(),
          estado: 'FINALIZADA',
        },
      });

      await tx.transaction.create({
        data: {
          tipo: 'PAGO_VENDEDOR',
          userId: payout.raffle.seller.id,
          raffleId: payout.raffleId,
          monto: Number(payout.netAmount),
          comisionPlataforma: Number(payout.platformFee),
          feeProcesamiento: Number(payout.processingFee),
          montoNeto: Number(payout.netAmount),
          providerPaymentId: providerResult.providerPayoutId,
          estado: 'COMPLETADO',
          metadata: {
            provider: 'MERCADO_PAGO',
            payoutId: payout.id,
          },
        },
      });
    });
  }

  private async assertSellerPayableCoversPayout(
    sellerId: string,
    amount: number,
  ) {
    const wallet = await this.walletService.ensureWalletAccount(
      this.prisma,
      sellerId,
    );
    if (Number(wallet.sellerPayableBalance) + 0.00001 < amount) {
      throw new BadRequestException(
        'El balance interno del vendedor no alcanza para liquidar',
      );
    }
  }

  private async hasSellerPayableDebit(payoutId: string): Promise<boolean> {
    const ledgerEntry = await this.prisma.walletLedgerEntry.findFirst({
      where: {
        payoutId,
        type: WalletLedgerEntryType.SELLER_PAYABLE_DEBIT,
      },
      select: { id: true },
    });

    return Boolean(ledgerEntry);
  }

  private toProviderMetadata(
    providerResult: MercadoPagoSellerPayoutResult,
  ): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(providerResult.metadata),
    ) as Prisma.InputJsonValue;
  }

  private async notifyPayoutScheduled(context: {
    sellerId: string;
    sellerEmail: string;
    raffleTitle: string;
    payoutId: string;
    scheduledFor: Date;
  }) {
    await this.runPayoutSideEffect('payout-scheduled-notification', context, [
      () =>
        this.notifications.create(
          context.sellerId,
          'INFO',
          'Pago programado',
          `Tu pago por "${context.raffleTitle}" será procesado el ${context.scheduledFor.toLocaleDateString('es-AR')}.`,
          '/dashboard/payouts',
        ),
      () =>
        this.notifications.sendPaymentWillBeReleasedNotification(
          context.sellerEmail,
          {
            raffleName: context.raffleTitle,
            daysRemaining: this.PAYOUT_DELAY_DAYS,
          },
        ),
    ]);
  }

  private async notifyPayoutCompleted(context: {
    sellerId: string;
    sellerEmail: string;
    raffleTitle: string;
    netAmount: number;
    fees: number;
  }) {
    await this.runPayoutSideEffect('payout-completed-notification', context, [
      () =>
        this.notifications.create(
          context.sellerId,
          'INFO',
          'Pago completado',
          `Tu pago de $${context.netAmount.toFixed(2)} por "${context.raffleTitle}" fue procesado.`,
          '/dashboard/payouts',
        ),
      () =>
        this.notifications.sendSellerPaymentNotification(context.sellerEmail, {
          raffleName: context.raffleTitle,
          amount: context.netAmount,
          fees: context.fees,
        }),
    ]);
  }

  private async notifyPayoutFailed(context: {
    sellerId: string;
    sellerEmail: string;
    raffleTitle: string;
    payoutId: string;
    netAmount: number;
    reason: string;
  }) {
    await this.runPayoutSideEffect('payout-failed-notification', context, [
      () =>
        this.notifications.create(
          context.sellerId,
          'SYSTEM',
          'Error en pago',
          `Hubo un problema procesando tu pago por "${context.raffleTitle}". Contactá soporte.`,
          '/dashboard/payouts',
        ),
      () =>
        this.notifications.sendPayoutFailedNotification(context.sellerEmail, {
          raffleName: context.raffleTitle,
          amount: context.netAmount,
          reason: context.reason,
        }),
    ]);
  }

  private async runPayoutSideEffect(
    stage: string,
    context: Record<string, unknown>,
    sideEffects: Array<() => Promise<unknown>>,
  ) {
    try {
      await Promise.all(sideEffects.map((sideEffect) => sideEffect()));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to run ${stage}: ${message}`);
      captureException(
        error instanceof Error ? error : new Error(`Failed to run ${stage}`),
        {
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage,
          },
          extra: context,
        },
      );
    }
  }

  /**
   * Returns the payout linked to a raffle, including minimal raffle context.
   */
  async getPayoutByRaffle(raffleId: string) {
    return this.prisma.payout.findUnique({
      where: { raffleId },
      include: {
        raffle: { select: { titulo: true, sellerId: true } },
      },
    });
  }

  /**
   * Returns the raffle payout only when the requester owns it or is an admin.
   */
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
   * Lists all payouts for a seller with the raffle title flattened into the result.
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
   * Lists all payouts that are still pending processing for admin views.
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
