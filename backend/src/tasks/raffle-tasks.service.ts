import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutsService } from '../payouts/payouts.service';

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
    this.cronEnabled =
      this.configService.get<string>('ENABLE_CRON_JOBS') !== 'false';
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
          estado: 'ACTIVA',
          fechaLimiteSorteo: { lt: new Date() },
          isDeleted: false,
        },
        include: {
          tickets: true,
          seller: true,
        },
      });

      for (const raffle of expiredRaffles) {
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

      // 3. Send confirmation reminder to winners (5 days after sorteo)
      await this.sendConfirmationReminders();

      this.logger.log('Finished: Process reminders and releases');
    } catch (error) {
      this.logger.error(
        'Error in reminders/releases:',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private async executeRaffleDraw(raffleId: string) {
    this.logger.log(`Executing draw for raffle ${raffleId}`);

    const paidTickets = await this.prisma.ticket.findMany({
      where: { raffleId, estado: 'PAGADO' },
      include: { buyer: true },
    });

    if (paidTickets.length === 0) {
      this.logger.warn(`No paid tickets for raffle ${raffleId}, cannot draw`);
      return;
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * paidTickets.length);
    const winningTicket = paidTickets[randomIndex];

    // Record draw result
    await this.prisma.drawResult.create({
      data: {
        raffleId,
        winningTicketId: winningTicket.id,
        winnerId: winningTicket.buyerId,
        method: 'RANDOM_INDEX',
        totalParticipants: paidTickets.length,
      },
    });

    // Update raffle
    const updatedRaffle = await this.prisma.raffle.update({
      where: { id: raffleId },
      data: {
        estado: 'SORTEADA',
        winnerId: winningTicket.buyerId,
        fechaSorteoReal: new Date(),
      },
      include: { product: true, seller: true, winner: true },
    });

    this.logger.log(`Raffle ${raffleId} winner: ${winningTicket.buyerId}`);

    // Send notifications
    // Send notifications
    if (updatedRaffle.winner) {
      // Email
      await this.notificationsService.sendWinnerNotification(
        updatedRaffle.winner.email,
        {
          raffleName: updatedRaffle.titulo,
          productName: updatedRaffle.product?.nombre || 'Producto',
          sellerEmail: updatedRaffle.seller.email,
        },
      );

      // In-App Notification (Winner)
      await this.notificationsService.create(
        updatedRaffle.winner.id,
        'WIN',
        '🎉 ¡Has ganado un sorteo!',
        `¡Felicidades! Ganaste la rifa "${updatedRaffle.titulo}". Contacta al vendedor para coordinar la entrega.`,
      );

      // Email Seller
      await this.notificationsService.sendSellerMustContactWinner(
        updatedRaffle.seller.email,
        {
          raffleName: updatedRaffle.titulo,
          winnerEmail: updatedRaffle.winner.email,
        },
      );

      // In-App Notification (Seller)
      await this.notificationsService.create(
        updatedRaffle.seller.id,
        'INFO',
        'Tu rifa tiene ganador',
        `La rifa "${updatedRaffle.titulo}" ha finalizado. Tienes 48hs para contactar al ganador.`,
      );
    }

    // Create payout record for the seller (will be released after delivery confirmation)
    try {
      await this.payoutsService.createPayout(raffleId);
      this.logger.log(`Payout created for raffle ${raffleId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to create payout for raffle ${raffleId}: ${message}`,
      );
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
    for (const ticket of raffle.tickets) {
      if (ticket.mpPaymentId) {
        try {
          await this.paymentsService.refundPayment(ticket.mpPaymentId);

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
          this.logger.error(`Failed to refund ticket ${ticket.id}:`, message);
        }
      }
    }

    // Update tickets to refunded
    await this.prisma.ticket.updateMany({
      where: { raffleId, estado: 'PAGADO' },
      data: { estado: 'REEMBOLSADO' },
    });

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

    await this.prisma.priceReduction.create({
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
          deliveryStatus: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      // Schedule and process payout
      try {
        if (!raffle.payout) {
          await this.payoutsService.createPayout(raffle.id);
        }
        await this.payoutsService.schedulePayoutAfterDelivery(raffle.id);
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
