import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DisputeTasksService {
  private readonly logger = new Logger(DisputeTasksService.name);
  private readonly cronEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {
    this.cronEnabled =
      this.configService.get<string>('ENABLE_CRON_JOBS') !== 'false';
  }

  /**
   * Every 6 hours - Process dispute escalations
   * - Escalate disputes without seller response after 48h
   * - Auto-refund disputes without resolution after 15 days
   */
  @Cron('0 */6 * * *') // Every 6 hours
  async processDisputeEscalations() {
    if (!this.cronEnabled) return;

    this.logger.log('Starting: Process dispute escalations');

    try {
      await this.escalateUnrespondedDisputes();
      await this.autoRefundOldDisputes();
      this.logger.log('Finished: Process dispute escalations');
    } catch (error) {
      this.logger.error(
        'Error processing disputes:',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Escalate disputes without seller response after 48 hours
   */
  private async escalateUnrespondedDisputes() {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const disputes = await this.prisma.dispute.findMany({
      where: {
        estado: 'ESPERANDO_RESPUESTA_VENDEDOR',
        createdAt: { lte: fortyEightHoursAgo },
        fechaRespuestaVendedor: null,
        isDeleted: false,
      },
      include: {
        raffle: { include: { seller: true } },
      },
    });

    for (const dispute of disputes) {
      this.logger.log(
        `Escalating dispute ${dispute.id} to EN_MEDIACION (no seller response)`,
      );

      await this.prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          estado: 'EN_MEDIACION',
          adminNotes:
            'Escalado automáticamente por falta de respuesta del vendedor en 48h.',
        },
      });

      // Notify admin of escalation (in production, would send to admin email)
      this.logger.log(
        `Dispute ${dispute.id} escalated and marked for priority review`,
      );
    }

    this.logger.log(`Escalated ${disputes.length} disputes`);
  }

  /**
   * Auto-refund disputes unresolved after 15 days
   */
  private async autoRefundOldDisputes() {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const disputes = await this.prisma.dispute.findMany({
      where: {
        estado: {
          in: ['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'],
        },
        createdAt: { lte: fifteenDaysAgo },
        resolvedAt: null,
        isDeleted: false,
      },
      include: {
        raffle: {
          include: {
            seller: true,
            tickets: { where: { estado: 'PAGADO' } },
          },
        },
        reporter: true,
      },
    });

    for (const dispute of disputes) {
      this.logger.log(
        `Auto-resolving dispute ${dispute.id} in favor of buyer (15 days timeout)`,
      );

      // Calculate total amount to refund
      const totalAmount = dispute.raffle.tickets.reduce(
        (sum, t) => sum + Number(t.precioPagado),
        0,
      );

      // Update dispute as resolved in favor of buyer
      await this.prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          estado: 'RESUELTA_COMPRADOR',
          resolvedAt: new Date(),
          resolucion:
            'Reembolso automático por tiempo de espera excedido (15 días sin resolución)',
          montoReembolsado: totalAmount,
          montoPagadoVendedor: 0,
        },
      });

      // Update raffle delivery status
      await this.prisma.raffle.update({
        where: { id: dispute.raffleId },
        data: { deliveryStatus: 'DISPUTED' },
      });

      // Send notifications
      await this.notificationsService.sendDisputeResolvedNotification(
        dispute.reporter.email,
        {
          raffleName: dispute.raffle.titulo,
          resolution: 'Resuelto a tu favor (tiempo de espera excedido)',
          refundAmount: totalAmount,
        },
      );

      await this.notificationsService.sendDisputeResolvedNotification(
        dispute.raffle.seller.email,
        {
          raffleName: dispute.raffle.titulo,
          resolution: 'Resuelto a favor del comprador por tiempo excedido',
        },
      );
    }

    this.logger.log(`Auto-resolved ${disputes.length} old disputes`);
  }
}
