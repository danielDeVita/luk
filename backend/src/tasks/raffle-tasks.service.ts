import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutsService } from '../payouts/payouts.service';
import { captureException } from '../sentry';

function isFalseEnvFlag(value: boolean | string | undefined): boolean {
  return (
    value === false ||
    (typeof value === 'string' && value.trim().toLowerCase() === 'false')
  );
}

@Injectable()
export class RaffleTasksService {
  private readonly logger = new Logger(RaffleTasksService.name);
  private readonly MIN_SALE_THRESHOLD = 0.7; // 70%
  private readonly cronEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notificationsService: NotificationsService,
    private payoutsService: PayoutsService,
    private configService: ConfigService,
  ) {
    const cronFlag = this.configService.get<boolean | string>(
      'ENABLE_CRON_JOBS',
    );
    this.cronEnabled = !isFalseEnvFlag(cronFlag);
  }

  /**
   * Every 5 minutes - Process expired raffles
   * - If 70%+ sold: execute draw
   * - If <70% sold: cancel and refund, suggest price
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processExpiredRaffles() {
    if (!this.cronEnabled) return;

    this.logger.log('Starting: Process expired raffles');

    try {
      const expiredRaffles = await this.prisma.raffle.findMany({
        where: {
          isDeleted: false,
          OR: [
            {
              estado: 'ACTIVA',
              fechaLimiteSorteo: { lt: new Date() },
            },
            {
              estado: 'COMPLETADA',
            },
          ],
        },
        include: {
          tickets: true,
          seller: true,
        },
      });

      for (const raffle of expiredRaffles) {
        if (raffle.estado === 'COMPLETADA') {
          await this.executeRaffleDraw(raffle.id);
          continue;
        }

        const paidTickets = raffle.tickets.filter((t) => t.estado === 'PAGADO');
        const percentSold = paidTickets.length / raffle.totalTickets;

        this.logger.log(
          `Raffle ${raffle.id}: ${(percentSold * 100).toFixed(1)}% sold (${paidTickets.length}/${raffle.totalTickets})`,
        );

        if (percentSold >= this.MIN_SALE_THRESHOLD) {
          await this.executeRaffleDraw(raffle.id);
        } else {
          await this.cancelAndRefundRaffle(raffle.id, percentSold);
        }
      }

      this.logger.log(
        `Finished: Processed ${expiredRaffles.length} expired raffles`,
      );
    } catch (error) {
      this.logger.error(
        'Error processing expired raffles:',
        error instanceof Error ? error.stack : error,
      );
      captureException(
        error instanceof Error
          ? error
          : new Error('Error processing expired raffles'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'raffles',
            stage: 'cron',
          },
        },
      );
    }
  }

  /**
   * Every hour - Process reminders and auto-releases
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processRemindersAndReleases() {
    if (!this.cronEnabled) return;

    this.logger.log('Starting: Process reminders and releases');

    try {
      // 1. Send reminders for raffles about to expire (24h before)
      await this.sendExpirationReminders();

      // 2. Auto-release payment after 7 days without confirmation
      await this.autoReleasePayments();

      // 3. Process due payouts
      await this.payoutsService.processDuePayouts();

      // 4. Send confirmation reminder to winners (5 days after sorteo)
      await this.sendConfirmationReminders();

      this.logger.log('Finished: Process reminders and releases');
    } catch (error) {
      this.logger.error(
        'Error in reminders/releases:',
        error instanceof Error ? error.stack : error,
      );
      captureException(
        error instanceof Error
          ? error
          : new Error('Error in raffle reminders/releases'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'raffles',
            stage: 'cron',
          },
        },
      );
    }
  }

  private async executeRaffleDraw(raffleId: string) {
    this.logger.log(`Executing draw for raffle ${raffleId}`);

    const wasDrawn = await this.paymentsService.drawRaffleIfEligible(raffleId);

    if (!wasDrawn) {
      this.logger.warn(`Raffle ${raffleId} was not eligible for draw`);
    } else {
      this.logger.log(`Draw completed for raffle ${raffleId}`);
    }
  }

  private async cancelAndRefundRaffle(raffleId: string, percentSold: number) {
    this.logger.log(
      `Cancelling raffle ${raffleId} (only ${(percentSold * 100).toFixed(1)}% sold)`,
    );

    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: {
        tickets: { where: { estado: 'PAGADO' }, include: { buyer: true } },
        seller: true,
      },
    });

    if (!raffle) return;

    // Refund all paid tickets
    const successfulRefundIds: string[] = [];
    const failedRefundIds: string[] = [];

    for (const ticket of raffle.tickets) {
      if (!ticket.mpPaymentId) {
        failedRefundIds.push(ticket.id);
        this.logger.error(`Ticket ${ticket.id} has no mpPaymentId for refund`);
        continue;
      }

      try {
        const success = await this.paymentsService.refundPayment(
          ticket.mpPaymentId,
        );

        if (!success) {
          failedRefundIds.push(ticket.id);
          continue;
        }

        successfulRefundIds.push(ticket.id);
        await this.notificationsService.sendRefundNotification(
          ticket.buyer.email,
          {
            raffleName: raffle.titulo,
            amount: Number(ticket.precioPagado),
            reason: 'La rifa no alcanzó el mínimo de ventas requerido (70%)',
          },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        failedRefundIds.push(ticket.id);
        this.logger.error(`Failed to refund ticket ${ticket.id}:`, message);
        captureException(
          error instanceof Error ? error : new Error('Ticket refund failed'),
          {
            user: ticket.buyerId ? { id: ticket.buyerId } : undefined,
            tags: {
              service: 'luk-backend',
              domain: 'raffles',
              stage: 'refund',
            },
            extra: {
              raffleId,
              ticketId: ticket.id,
              paymentId: ticket.mpPaymentId,
            },
          },
        );
      }
    }

    if (failedRefundIds.length > 0) {
      this.logger.warn(
        `Raffle ${raffleId} cancellation paused: ${failedRefundIds.length} refund(s) failed`,
      );
      if (successfulRefundIds.length > 0) {
        await this.prisma.ticket.updateMany({
          where: { id: { in: successfulRefundIds }, estado: 'PAGADO' },
          data: { estado: 'REEMBOLSADO' },
        });
      }
      return;
    }

    if (successfulRefundIds.length > 0) {
      await this.prisma.ticket.updateMany({
        where: { id: { in: successfulRefundIds }, estado: 'PAGADO' },
        data: { estado: 'REEMBOLSADO' },
      });
    }

    // Update raffle status
    await this.prisma.raffle.update({
      where: { id: raffleId },
      data: { estado: 'CANCELADA' },
    });

    // Calculate and create price reduction suggestion
    const percentNotSold = 1 - percentSold;
    const reductionFactor = percentNotSold * 0.5;
    const currentPrice = Number(raffle.precioPorTicket);
    const suggestedPrice =
      Math.round(currentPrice * (1 - reductionFactor) * 100) / 100;

    const priceReduction = await this.prisma.priceReduction.create({
      data: {
        raffleId,
        precioAnterior: currentPrice,
        precioSugerido: suggestedPrice,
        porcentajeReduccion: reductionFactor * 100,
        ticketsVendidosAlMomento: raffle.tickets.length,
      },
    });

    // Notify seller
    await this.notificationsService.sendPriceReductionSuggestion(
      raffle.seller.email,
      {
        raffleName: raffle.titulo,
        currentPrice,
        suggestedPrice,
        percentageSold: percentSold,
        raffleId,
        priceReductionId: priceReduction.id,
      },
    );
  }

  private async sendExpirationReminders() {
    const in24Hours = new Date();
    in24Hours.setHours(in24Hours.getHours() + 24);

    const raffles = await this.prisma.raffle.findMany({
      where: {
        estado: 'ACTIVA',
        fechaLimiteSorteo: {
          gte: new Date(),
          lte: in24Hours,
        },
        isDeleted: false,
      },
      include: { seller: true },
    });

    for (const raffle of raffles) {
      this.logger.log(`Sending expiration reminder for raffle ${raffle.id}`);
      // Notification would be sent here
    }
  }

  private async autoReleasePayments() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const raffles = await this.prisma.raffle.findMany({
      where: {
        estado: 'SORTEADA',
        fechaSorteoReal: { lte: sevenDaysAgo },
        deliveryStatus: { in: ['PENDING', 'SHIPPED', 'DELIVERED'] },
        paymentReleasedAt: null,
        isDeleted: false,
      },
      include: { seller: true, dispute: true, payout: true },
    });

    for (const raffle of raffles) {
      // Skip if there's an active dispute
      if (raffle.dispute && !raffle.dispute.resolvedAt) {
        continue;
      }

      this.logger.log(`Auto-releasing payment for raffle ${raffle.id}`);

      // Update raffle delivery status
      await this.prisma.raffle.update({
        where: { id: raffle.id },
        data: {
          estado: 'EN_ENTREGA',
          deliveryStatus: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      // Process payout immediately once auto-confirmed
      try {
        await this.payoutsService.processPayoutForRaffle(raffle.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to process payout for raffle ${raffle.id}: ${message}`,
        );
      }
    }
  }

  private async sendConfirmationReminders() {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const raffles = await this.prisma.raffle.findMany({
      where: {
        estado: 'SORTEADA',
        fechaSorteoReal: {
          gte: fiveDaysAgo,
          lte: new Date(),
        },
        deliveryStatus: { in: ['PENDING', 'SHIPPED'] },
        confirmedAt: null,
        isDeleted: false,
      },
      include: { winner: true },
    });

    for (const raffle of raffles) {
      if (raffle.winner) {
        this.logger.log(
          `Sending confirmation reminder for raffle ${raffle.id}`,
        );

        await this.notificationsService.sendDeliveryReminderToWinner(
          raffle.winner.email,
          {
            raffleName: raffle.titulo,
            daysSinceShipped: 5,
          },
        );
      }
    }
  }
}
