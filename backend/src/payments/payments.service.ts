import { BadRequestException, Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PLATFORM_FEE_RATE, MP_FEE_ESTIMATE_RATE } from '../common/constants/fees.constants';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { ReferralsService } from '../referrals/referrals.service';
import {
  RaffleEvents,
  TicketsPurchasedEvent,
  RaffleCompletedEvent,
} from '../common/events';

// Default hold period: funds held until manual release or auto-release after delivery
const DEFAULT_MONEY_RELEASE_DAYS = 30; // Max hold period allowed by MP

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly mpClient?: MercadoPagoConfig;
  private readonly platformFeeRate: number;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private activityService: ActivityService,
    private eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => ReferralsService))
    private referralsService: ReferralsService,
  ) {
    const accessToken = this.configService.get<string>('MP_ACCESS_TOKEN');
    if (accessToken) {
      this.mpClient = new MercadoPagoConfig({ accessToken });
    }
    // Allow env override, otherwise use shared constant
    const envFeePercent = this.configService.get<number>('MP_PLATFORM_FEE_PERCENT');
    this.platformFeeRate = envFeePercent ? envFeePercent / 100 : PLATFORM_FEE_RATE;
  }

  private getMpClient(): MercadoPagoConfig {
    if (!this.mpClient) {
      throw new BadRequestException('Mercado Pago no está configurado (MP_ACCESS_TOKEN faltante)');
    }
    return this.mpClient;
  }

  private normalizeBaseUrl(value: string | undefined | null, fallback: string): string {
    const raw = (value || '').trim();
    const base = raw.length ? raw : fallback;
    const withScheme = /^https?:\/\//i.test(base) ? base : `http://${base}`;
    return withScheme.replace(/\/$/, '');
  }

  // ==================== Mercado Pago Preference ====================

  /**
   * Creates a Mercado Pago payment preference for ticket purchase.
   * Returns the init_point URL where the buyer should be redirected.
   */
  async createPreference(data: {
    raffleId: string;
    cantidad: number;
    buyerId: string;
    precioPorTicket: number;
    tituloRifa: string;
    reservationId: string;
  }): Promise<{ initPoint: string; preferenceId: string }> {
    const totalAmount = data.cantidad * data.precioPorTicket;
    const platformFee = totalAmount * this.platformFeeRate;
    const frontendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('FRONTEND_URL'),
      'http://localhost:3000',
    );
    const backendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('BACKEND_URL'),
      'http://localhost:3001',
    );

    const successUrl = `${frontendUrl}/checkout/status`;
    const failureUrl = `${frontendUrl}/checkout/status`;
    const pendingUrl = `${frontendUrl}/checkout/status`;

    const shouldAutoReturn =
      /^https:\/\//i.test(successUrl) && !/localhost|127\.0\.0\.1/i.test(successUrl);

    this.logger.log(
      `MP preference URLs: success=${successUrl} failure=${failureUrl} pending=${pendingUrl} (auto_return=${shouldAutoReturn})`,
    );

    const preference = new Preference(this.getMpClient());

    try {
      // Build preference body with delayed disbursement
      // money_release_date is not in SDK types but is supported by MP API
      const preferenceBody = {
        items: [
          {
            id: data.raffleId,
            title: `${data.cantidad} Ticket(s) - ${data.tituloRifa}`,
            quantity: 1,
            unit_price: totalAmount,
            currency_id: 'ARS',
          },
        ],
        payer: {
          // In production, fetch buyer email from database
        },
        back_urls: {
          success: successUrl,
          failure: failureUrl,
          pending: pendingUrl,
        },
        ...(shouldAutoReturn ? { auto_return: 'approved' as const } : {}),
        external_reference: JSON.stringify({
          raffleId: data.raffleId,
          buyerId: data.buyerId,
          cantidad: data.cantidad,
          reservationId: data.reservationId,
        }),
        marketplace_fee: platformFee,
        notification_url: `${backendUrl}/mp/webhook`,
        // DELAYED DISBURSEMENT: Hold funds until release or auto-release date
        // This ensures refunds are possible and disputes can be resolved
        money_release_days: DEFAULT_MONEY_RELEASE_DAYS,
      };

      const preferenceResponse = await preference.create({
        body: preferenceBody as any,
      });

      this.logger.log(
        `Created MP preference ${preferenceResponse.id} for raffle ${data.raffleId} (auto_return=${shouldAutoReturn})`,
      );

      return {
        initPoint: preferenceResponse.init_point!,
        preferenceId: preferenceResponse.id!,
      };
    } catch (error: any) {
      const details = error?.message || 'Mercado Pago preference create failed';
      this.logger.error(`MP preference create failed: ${details}`);
      throw new BadRequestException(details);
    }
  }

  // ==================== Payment Status ====================

  /**
   * Gets the status of a Mercado Pago payment by ID.
   */
  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    statusDetail: string;
    externalReference: string | null;
  }> {
    const payment = new Payment(this.getMpClient());
    const paymentData = await payment.get({ id: paymentId });

    return {
      status: paymentData.status || 'unknown',
      statusDetail: paymentData.status_detail || '',
      externalReference: paymentData.external_reference || null,
    };
  }

  // ==================== Webhook Handlers ====================

  /**
   * Handles Mercado Pago IPN (Instant Payment Notification) webhook.
   */
  async handleMpWebhook(data: {
    type: string;
    data: { id: string };
  }): Promise<void> {
    if (data.type !== 'payment') {
      this.logger.log(`Ignoring MP webhook type: ${data.type}`);
      return;
    }

    const paymentId = data.data.id;

    // Check idempotency
    const existing = await this.prisma.mpEvent.findUnique({
      where: { eventId: paymentId },
    });
    if (existing) {
      this.logger.log(`MP event ${paymentId} already processed`);
      return;
    }

    // Get payment details
    const payment = new Payment(this.getMpClient());
    const paymentData = await payment.get({ id: paymentId });

    if (paymentData.status === 'approved') {
      await this.handlePaymentApproved(paymentData);
    }

    // Mark as processed
    await this.prisma.mpEvent.create({
      data: {
        eventId: paymentId,
        eventType: `payment.${paymentData.status}`,
        metadata: paymentData as any,
      },
    });
  }

  /**
   * Manually syncs payment status with Mercado Pago.
   * Useful when webhook fails or for local development without tunnels.
   * Returns sync result with status and whether tickets were processed.
   */
  async syncPaymentStatus(paymentId: string): Promise<{
    status: string;
    alreadyProcessed: boolean;
    ticketsUpdated: number;
  }> {
    try {
      // Check if already processed
      const existing = await this.prisma.mpEvent.findUnique({
        where: { eventId: paymentId },
      });

      if (existing) {
        this.logger.log(`Payment ${paymentId} already processed, skipping sync`);
        return {
          status: 'approved',
          alreadyProcessed: true,
          ticketsUpdated: 0,
        };
      }

      const payment = new Payment(this.getMpClient());
      const paymentData = await payment.get({ id: paymentId });

      if (paymentData.status === 'approved') {
        await this.handlePaymentApproved(paymentData);

        // Mark as processed
        await this.prisma.mpEvent.create({
          data: {
            eventId: paymentId,
            eventType: `payment.${paymentData.status}`,
            metadata: paymentData as any,
          },
        });

        // Get count of updated tickets
        const ticketCount = await this.prisma.ticket.count({
          where: { mpPaymentId: String(paymentData.id) },
        });

        return {
          status: paymentData.status,
          alreadyProcessed: false,
          ticketsUpdated: ticketCount,
        };
      }

      return {
        status: paymentData.status || 'unknown',
        alreadyProcessed: false,
        ticketsUpdated: 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to sync payment ${paymentId}: ${message}`);
      throw error;
    }
  }

  /**
   * Handles approved payment - confirms tickets and records transaction.
   */
  async handlePaymentApproved(paymentData: any): Promise<void> {
    const externalRef = paymentData.external_reference;
    if (!externalRef) {
      this.logger.warn('Payment approved but no external_reference found');
      return;
    }

    let refData: {
      raffleId: string;
      buyerId: string;
      cantidad: number;
      reservationId?: string;
    };
    try {
      refData = JSON.parse(externalRef);
    } catch {
      this.logger.error(`Failed to parse external_reference: ${externalRef}`);
      return;
    }

    const { raffleId, buyerId, cantidad } = refData;
    const reservationId = refData.reservationId;
    const mpPaymentId = String(paymentData.id);

    // Update tickets to PAGADO
    const updatedTickets = await this.prisma.ticket.updateMany({
      where: {
        raffleId,
        buyerId,
        estado: 'RESERVADO',
        ...(reservationId ? { mpExternalReference: reservationId } : {}),
      },
      data: {
        estado: 'PAGADO',
        mpPaymentId,
        ...(reservationId ? { mpExternalReference: reservationId } : {}),
      },
    });

    if (updatedTickets.count === 0) {
      this.logger.warn(
        `No reserved tickets updated for raffle ${raffleId} buyer ${buyerId} (reservationId=${reservationId ?? 'none'})`,
      );
    }

    this.logger.log(
      `Updated ${updatedTickets.count} tickets to PAGADO for raffle ${raffleId}`,
    );

    // Create transaction record
    const existingTx = await this.prisma.transaction.findFirst({
      where: {
        tipo: 'COMPRA_TICKET',
        mpPaymentId,
        isDeleted: false,
      },
      select: { id: true },
    });

    if (existingTx) {
      this.logger.log(`Transaction already exists for mpPaymentId ${mpPaymentId} (tx=${existingTx.id})`);
      await this.checkRaffleCompletion(raffleId);
      return;
    }

    const totalAmount = Number(paymentData.transaction_amount);
    const platformFee = totalAmount * this.platformFeeRate;
    const mpFee = Number(paymentData.fee_details?.[0]?.amount || 0);
    const netAmount = totalAmount - platformFee - mpFee;

    await this.prisma.transaction.create({
      data: {
        tipo: 'COMPRA_TICKET',
        userId: buyerId,
        raffleId,
        monto: totalAmount,
        comisionPlataforma: platformFee,
        feeProcesamiento: mpFee,
        montoNeto: netAmount,
        mpPaymentId,
        estado: 'COMPLETADO',
        metadata: {
          externalReference: externalRef,
          reservationId: reservationId ?? null,
          status: paymentData.status ?? null,
          statusDetail: paymentData.status_detail ?? null,
        } as any,
      },
    });

    // Send notifications for ticket purchase
    try {
      const [buyer, raffle, tickets] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: buyerId }, select: { email: true, nombre: true } }),
        this.prisma.raffle.findUnique({ where: { id: raffleId }, select: { titulo: true, sellerId: true } }),
        this.prisma.ticket.findMany({
          where: { raffleId, buyerId, mpPaymentId },
          select: { id: true, numeroTicket: true },
        }),
      ]);

      if (buyer && raffle) {
        const ticketNumbers = tickets.map(t => t.numeroTicket);

        // Send purchase confirmation email
        await this.notificationsService.sendTicketPurchaseConfirmation(buyer.email, {
          raffleName: raffle.titulo,
          ticketNumbers,
          amount: totalAmount,
        });

        // Create in-app notification
        await this.notificationsService.create(
          buyerId,
          'PURCHASE',
          '¡Compra confirmada!',
          `Compraste ${ticketNumbers.length} ticket(s) para "${raffle.titulo}". Números: ${ticketNumbers.join(', ')}`,
        );

        // Log activity
        await this.activityService.logTicketsPurchased(
          buyerId,
          raffleId,
          ticketNumbers,
          totalAmount,
          mpPaymentId,
        );

        // Emit tickets purchased event for cross-cutting concerns
        this.eventEmitter.emit(
          RaffleEvents.TICKETS_PURCHASED,
          new TicketsPurchasedEvent(raffleId, buyerId, ticketNumbers.length, totalAmount, mpPaymentId),
        );

        // Process referral reward if this is the user's first purchase
        this.referralsService.processFirstPurchaseReward(buyerId, totalAmount, tickets[0]?.id).catch((err) => {
          this.logger.error(`Failed to process referral reward: ${err.message}`);
        });
      }
    } catch (notifError) {
      // Don't fail payment processing if notifications fail
      this.logger.error(`Failed to send purchase notifications: ${(notifError as Error).message}`);
    }

    // Check raffle completion
    await this.checkRaffleCompletion(raffleId);
  }

  // ==================== Transfers to Sellers ====================

  /**
   * For MVP: Records transfer to seller (manual payout in MP dashboard).
   * In production with Marketplace API, this would use splits.
   */
  async transferToSeller(raffleId: string): Promise<{ netAmount: number; totalAmount: number } | null> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: { tickets: { where: { estado: 'PAGADO' } } },
    });

    if (!raffle) {
      this.logger.warn(`Raffle ${raffleId} not found for transfer`);
      return null;
    }

    const totalAmount = raffle.tickets.reduce(
      (sum, t) => sum + Number(t.precioPagado),
      0,
    );

    const { netAmount, platformFee, mpFee } = this.calculateCommissions(totalAmount);

    this.logger.log(
      `Recording transfer for raffle ${raffleId}: $${netAmount} to seller ${raffle.sellerId}`,
    );

    // Update raffle payment status
    await this.prisma.raffle.update({
      where: { id: raffleId },
      data: { paymentReleasedAt: new Date() },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        tipo: 'PAGO_VENDEDOR',
        userId: raffle.sellerId,
        raffleId,
        monto: totalAmount,
        comisionPlataforma: platformFee,
        feeProcesamiento: mpFee,
        montoNeto: netAmount,
        mpMerchantOrderId: `manual_${Date.now()}`,
        estado: 'COMPLETADO',
      },
    });

    return { netAmount, totalAmount };
  }

  // ==================== Refunds ====================

  /**
   * Refunds a Mercado Pago payment.
   */
  async refundPayment(mpPaymentId: string): Promise<boolean> {
    try {
      const mpClient = this.getMpClient();
      // Mercado Pago SDK v2 uses PaymentRefund for refunds
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpClient.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Refund failed: ${response.statusText}`);
      }

      this.logger.log(`Refund processed for payment ${mpPaymentId}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Refund failed for ${mpPaymentId}: ${message}`);
      return false;
    }
  }

  // ==================== Fund Release (Delayed Disbursement) ====================

  /**
   * Releases held funds to the seller after delivery confirmation.
   * This is used with delayed disbursement (money_release_days) to release funds early.
   *
   * @param raffleId - The raffle ID to release funds for
   * @returns Object with release status and details
   */
  async releaseFundsToSeller(raffleId: string): Promise<{
    success: boolean;
    releasedPayments: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let releasedPayments = 0;

    // Get all paid tickets for this raffle with their payment IDs
    const tickets = await this.prisma.ticket.findMany({
      where: {
        raffleId,
        estado: 'PAGADO',
        mpPaymentId: { not: null },
      },
      select: { mpPaymentId: true },
      distinct: ['mpPaymentId'],
    });

    if (tickets.length === 0) {
      this.logger.warn(`No paid tickets found for raffle ${raffleId}`);
      return { success: false, releasedPayments: 0, errors: ['No hay pagos para liberar'] };
    }

    const mpClient = this.getMpClient();

    // Release each payment
    for (const ticket of tickets) {
      if (!ticket.mpPaymentId) continue;

      try {
        // MP API: POST /v1/payments/{id}/releases to release held funds
        const response = await fetch(
          `https://api.mercadopago.com/v1/payments/${ticket.mpPaymentId}/releases`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mpClient.accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.ok) {
          releasedPayments++;
          this.logger.log(`Released funds for payment ${ticket.mpPaymentId}`);
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.message || response.statusText;

          // If already released, count as success
          if (response.status === 400 && errorMsg.includes('already released')) {
            releasedPayments++;
            this.logger.log(`Payment ${ticket.mpPaymentId} was already released`);
          } else {
            errors.push(`Payment ${ticket.mpPaymentId}: ${errorMsg}`);
            this.logger.error(`Failed to release payment ${ticket.mpPaymentId}: ${errorMsg}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Payment ${ticket.mpPaymentId}: ${message}`);
        this.logger.error(`Exception releasing payment ${ticket.mpPaymentId}: ${message}`);
      }
    }

    const success = releasedPayments > 0 && errors.length === 0;

    if (success) {
      // Update raffle to mark payment as released
      await this.prisma.raffle.update({
        where: { id: raffleId },
        data: { paymentReleasedAt: new Date() },
      });

      this.logger.log(`Released ${releasedPayments} payments for raffle ${raffleId}`);
    }

    return { success, releasedPayments, errors };
  }

  /**
   * Check if funds can be released for a raffle.
   * Funds can be released when delivery is confirmed or after auto-release period.
   */
  async canReleaseFunds(raffleId: string): Promise<{
    canRelease: boolean;
    reason: string;
  }> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: {
        estado: true,
        deliveryStatus: true,
        paymentReleasedAt: true,
        dispute: { select: { estado: true } },
      },
    });

    if (!raffle) {
      return { canRelease: false, reason: 'Rifa no encontrada' };
    }

    if (raffle.paymentReleasedAt) {
      return { canRelease: false, reason: 'Los fondos ya fueron liberados' };
    }

    if (raffle.dispute && !['RESUELTA_VENDEDOR', 'RESUELTA_PARCIAL'].includes(raffle.dispute.estado)) {
      return { canRelease: false, reason: 'Hay una disputa activa' };
    }

    if (raffle.deliveryStatus !== 'CONFIRMED') {
      return { canRelease: false, reason: 'La entrega no ha sido confirmada' };
    }

    if (!['SORTEADA', 'EN_ENTREGA', 'FINALIZADA'].includes(raffle.estado)) {
      return { canRelease: false, reason: `Estado de rifa no válido: ${raffle.estado}` };
    }

    return { canRelease: true, reason: 'OK' };
  }

  // ==================== Calculations ====================

  calculateMpFees(amount: number): number {
    return amount * MP_FEE_ESTIMATE_RATE;
  }

  calculateCommissions(totalAmount: number) {
    const platformFee = totalAmount * this.platformFeeRate;
    const mpFee = this.calculateMpFees(totalAmount);
    const totalFees = platformFee + mpFee;
    const netAmount = totalAmount - totalFees;

    return { platformFee, mpFee, totalFees, netAmount };
  }

  // ==================== Idempotency ====================

  async isEventProcessed(eventId: string): Promise<boolean> {
    const event = await this.prisma.mpEvent.findUnique({
      where: { eventId },
    });
    return !!event;
  }

  async markEventProcessed(eventId: string, eventType: string): Promise<void> {
    await this.prisma.mpEvent.create({
      data: {
        eventId,
        eventType,
      },
    });
  }

  // ==================== Helper Methods ====================

  private async checkRaffleCompletion(raffleId: string) {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: { tickets: true },
    });

    if (!raffle) return;

    const paidTickets = raffle.tickets.filter((t) => t.estado === 'PAGADO');
    const paidTicketCount = paidTickets.length;

    if (paidTicketCount >= raffle.totalTickets) {
      this.logger.log(`Raffle ${raffleId} is now COMPLETADA (100% tickets sold)`);
      await this.prisma.raffle.update({
        where: { id: raffleId },
        data: { estado: 'COMPLETADA' },
      });

      // Calculate total amount from tickets
      const totalAmount = paidTickets.reduce((sum, t) => sum + Number(t.precioPagado), 0);

      // Emit raffle completed event for cross-cutting concerns
      this.eventEmitter.emit(
        RaffleEvents.COMPLETED,
        new RaffleCompletedEvent(raffleId, raffle.sellerId, paidTicketCount, totalAmount),
      );
    }
  }
}
