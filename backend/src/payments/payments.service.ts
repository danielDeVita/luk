import {
  BadRequestException,
  Injectable,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MockPaymentStatus, Prisma } from '@prisma/client';
import type { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import { MP_FEE_ESTIMATE_RATE } from '../common/constants/fees.constants';
import { TicketPurchaseMode } from '../common/enums';
import { getPlatformFeeRate } from '../common/config/platform-fee.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { ReferralsService } from '../referrals/referrals.service';
import { PayoutsService } from '../payouts/payouts.service';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';
import {
  RaffleEvents,
  TicketsPurchasedEvent,
  RaffleCompletedEvent,
  RaffleDrawnEvent,
} from '../common/events';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import type {
  CreateCheckoutSessionInput,
  MockPaymentAction,
  MockPaymentActionResult,
  MockPaymentSummary,
} from './providers/payment-provider.types';

// Type guard to check if an error has a message property
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

// Interface for parsed external reference data
interface ExternalReferenceData {
  raffleId: string;
  buyerId: string;
  cantidad: number;
  reservationId?: string;
  bonusGrantId?: string | null;
  grossSubtotal?: number;
  discountApplied?: number;
  mpChargeAmount?: number;
  promotionToken?: string | null;
  purchaseMode?: TicketPurchaseMode;
  selectedNumbers?: number[] | null;
  selectionPremiumPercent?: number;
  selectionPremiumAmount?: number;
}

/**
 * Coordinates checkout creation, payment state transitions, and post-payment side effects
 * across Mercado Pago and the local mock provider.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly platformFeeRate: number;
  private readonly paymentsProvider: 'mercadopago' | 'mock';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private activityService: ActivityService,
    private eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => ReferralsService))
    private referralsService: ReferralsService,
    @Inject(forwardRef(() => PayoutsService))
    private payoutsService: PayoutsService,
    @Inject(forwardRef(() => SocialPromotionsService))
    private socialPromotionsService: SocialPromotionsService,
    private readonly mercadoPagoProvider: MercadoPagoProvider,
    private readonly mockPaymentProvider: MockPaymentProvider,
  ) {
    const accessToken = (
      this.configService.get<string>('MP_ACCESS_TOKEN') || ''
    )
      .trim()
      .toLowerCase();
    const mpMockModeFlag = this.configService.get<boolean | string>(
      'MP_MOCK_MODE',
    );
    const explicitProvider = (
      this.configService.get<string>('PAYMENTS_PROVIDER') || ''
    )
      .trim()
      .toLowerCase();

    const mpMockMode =
      mpMockModeFlag === true ||
      (typeof mpMockModeFlag === 'string' &&
        mpMockModeFlag.trim().toLowerCase() === 'true') ||
      accessToken === 'mock';
    this.paymentsProvider =
      explicitProvider === 'mock' || mpMockMode ? 'mock' : 'mercadopago';

    if (this.paymentsProvider === 'mock') {
      this.logger.warn('⚠️ Mercado Pago service in MOCK mode');
    }
    this.platformFeeRate = getPlatformFeeRate(this.configService);
  }

  // ==================== Mercado Pago Preference ====================

  /**
   * Creates a checkout session for a reserved ticket purchase using the active provider.
   */
  async createPreference(data: {
    raffleId: string;
    cantidad: number;
    buyerId: string;
    precioPorTicket: number;
    tituloRifa: string;
    reservationId: string;
    grossSubtotal?: number;
    discountApplied?: number;
    mpChargeAmount?: number;
    bonusGrantId?: string | null;
    promotionBonusRedemptionId?: string | null;
    promotionToken?: string | null;
    purchaseMode?: TicketPurchaseMode;
    selectedNumbers?: number[] | null;
    selectionPremiumPercent?: number;
    selectionPremiumAmount?: number;
  }): Promise<{ initPoint: string; preferenceId: string }> {
    const grossSubtotal =
      data.grossSubtotal ?? data.cantidad * data.precioPorTicket;
    const cashChargedAmount = data.mpChargeAmount ?? grossSubtotal;
    const discountApplied = data.discountApplied ?? 0;

    if (this.paymentsProvider === 'mock') {
      await this.expireSupersededInitiatedMockPayments(
        data.buyerId,
        data.raffleId,
      );
    }

    const sessionInput: CreateCheckoutSessionInput = {
      raffleId: data.raffleId,
      cantidad: data.cantidad,
      buyerId: data.buyerId,
      precioPorTicket: data.precioPorTicket,
      tituloRifa: data.tituloRifa,
      reservationId: data.reservationId,
      grossSubtotal,
      discountApplied,
      cashChargedAmount,
      bonusGrantId: data.bonusGrantId ?? null,
      promotionBonusRedemptionId: data.promotionBonusRedemptionId ?? null,
      promotionToken: data.promotionToken ?? null,
      purchaseMode: data.purchaseMode ?? TicketPurchaseMode.RANDOM,
      selectedNumbers: data.selectedNumbers ?? null,
      selectionPremiumPercent: data.selectionPremiumPercent ?? 0,
      selectionPremiumAmount: data.selectionPremiumAmount ?? 0,
    };

    return this.paymentsProvider === 'mock'
      ? this.mockPaymentProvider.createCheckoutSession(sessionInput)
      : this.mercadoPagoProvider.createCheckoutSession(sessionInput);
  }

  /**
   * Expires older initiated mock checkouts for the same buyer and raffle before opening a new one.
   */
  async expireSupersededInitiatedMockPaymentsForRaffle(
    buyerId: string,
    raffleId: string,
  ): Promise<void> {
    if (this.paymentsProvider !== 'mock') {
      return;
    }

    await this.expireSupersededInitiatedMockPayments(buyerId, raffleId);
  }

  // ==================== Payment Status ====================

  /**
   * Returns normalized payment status data for either Mercado Pago or the mock provider.
   */
  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    statusDetail: string;
    externalReference: string | null;
    merchantOrderId?: string | null;
  }> {
    return this.isMockPaymentId(paymentId)
      ? this.mockPaymentProvider.getPaymentStatus(paymentId)
      : this.mercadoPagoProvider.getPaymentStatus(paymentId);
  }

  private isMockPaymentId(paymentId: string): boolean {
    return paymentId.startsWith('mock_pay_');
  }

  /**
   * Loads the mock checkout summary after validating its public token.
   */
  async getMockPaymentForCheckout(
    paymentId: string,
    publicToken: string,
  ): Promise<MockPaymentSummary> {
    return this.mockPaymentProvider.getPaymentForCheckout(
      paymentId,
      publicToken,
    );
  }

  /**
   * Applies a QA action to a mock payment and returns the resulting checkout redirect data.
   */
  async processMockPaymentAction(
    paymentId: string,
    publicToken: string,
    action: MockPaymentAction,
    amount?: number,
  ): Promise<MockPaymentActionResult> {
    const payment = await this.mockPaymentProvider.getPaymentForCheckout(
      paymentId,
      publicToken,
    );

    switch (action) {
      case 'APPROVE':
        await this.approveMockPayment(paymentId);
        break;
      case 'PEND':
        await this.markMockPaymentPending(paymentId);
        break;
      case 'REJECT':
        await this.rejectOrExpireMockPayment(paymentId, 'rejected');
        break;
      case 'EXPIRE':
        await this.rejectOrExpireMockPayment(paymentId, 'expired');
        break;
      case 'REFUND_FULL':
        await this.refundMockPayment(paymentId, undefined, true);
        break;
      case 'REFUND_PARTIAL':
        if (typeof amount !== 'number' || amount <= 0) {
          throw new BadRequestException(
            'Debes indicar un monto válido para el reintegro parcial',
          );
        }
        await this.refundMockPayment(paymentId, amount, false);
        break;
      default:
        throw new BadRequestException('Acción mock no soportada');
    }

    const refreshed = await this.getPaymentStatus(paymentId);

    return {
      paymentId,
      status: refreshed.status,
      merchantOrderId: refreshed.merchantOrderId || payment.merchantOrderId,
      redirectUrl: this.buildMockStatusRedirectUrl(
        paymentId,
        refreshed.status,
        refreshed.merchantOrderId || payment.merchantOrderId,
        publicToken,
      ),
      mockToken: publicToken,
    };
  }

  private buildMockStatusRedirectUrl(
    paymentId: string,
    status: string,
    merchantOrderId: string,
    publicToken: string,
  ): string {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const baseUrl = frontendUrl.replace(/\/$/, '');
    const params = new URLSearchParams({
      payment_id: paymentId,
      status,
      merchant_order_id: merchantOrderId,
      mock_token: publicToken,
    });
    return `${baseUrl}/checkout/status?${params.toString()}`;
  }

  private buildMockPaymentResponse(
    payment: Awaited<ReturnType<MockPaymentProvider['getPayment']>>,
    status: string,
    statusDetail: string,
  ): PaymentResponse {
    return {
      id: payment.id,
      status,
      status_detail: statusDetail,
      transaction_amount: Number(payment.cashChargedAmount),
      external_reference: payment.externalReference,
      fee_details: [],
      order: {
        id: payment.merchantOrderId,
      },
    } as unknown as PaymentResponse;
  }

  /**
   * Clears stale mock payments, reserved tickets, and reserved promotion bonuses
   * that were superseded by a newer checkout attempt.
   */
  private async expireSupersededInitiatedMockPayments(
    buyerId: string,
    raffleId: string,
  ): Promise<void> {
    const stalePayments = await this.prisma.mockPayment.findMany({
      where: {
        buyerId,
        raffleId,
        status: MockPaymentStatus.INITIATED,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    for (const stalePayment of stalePayments) {
      await this.prisma.ticket.deleteMany({
        where: {
          estado: 'RESERVADO',
          mpExternalReference: stalePayment.reservationId,
        },
      });

      await this.socialPromotionsService.releaseReservedRedemptionByReservation(
        stalePayment.reservationId,
      );

      await this.mockPaymentProvider.updatePaymentStatus(
        stalePayment.id,
        MockPaymentStatus.EXPIRED,
        'Pago mock expirado por reemplazo de checkout',
        {
          processedAt: new Date(),
        },
      );

      await this.mockPaymentProvider.recordEvent({
        paymentId: stalePayment.id,
        eventType: this.mockPaymentProvider.getActionType('EXPIRE'),
        status: MockPaymentStatus.EXPIRED,
        metadata: {
          reservationId: stalePayment.reservationId,
          reason: 'superseded_by_new_checkout',
        },
      });
    }
  }

  private async approveMockPayment(paymentId: string): Promise<void> {
    const payment = await this.mockPaymentProvider.getPayment(paymentId);
    if (payment.processedAt) {
      return;
    }

    if (
      payment.status === MockPaymentStatus.REJECTED ||
      payment.status === MockPaymentStatus.EXPIRED ||
      payment.status === MockPaymentStatus.REFUNDED_FULL ||
      payment.status === MockPaymentStatus.REFUNDED_PARTIAL
    ) {
      throw new BadRequestException(
        'No podés aprobar un pago mock en este estado',
      );
    }

    const approvedPaymentData = this.buildMockPaymentResponse(
      payment,
      'approved',
      'mock_approved',
    );

    await this.handlePaymentApproved(approvedPaymentData);
    await this.mockPaymentProvider.updatePaymentStatus(
      paymentId,
      MockPaymentStatus.APPROVED,
      'Pago mock aprobado',
      {
        approvedAt: new Date(),
        processedAt: new Date(),
      },
    );
    await this.mockPaymentProvider.recordEvent({
      paymentId,
      eventType: this.mockPaymentProvider.getActionType('APPROVE'),
      status: MockPaymentStatus.APPROVED,
      metadata: {
        reservationId: payment.reservationId,
      },
    });
  }

  private async markMockPaymentPending(paymentId: string): Promise<void> {
    const payment = await this.mockPaymentProvider.getPayment(paymentId);
    if (
      payment.status === MockPaymentStatus.APPROVED ||
      payment.status === MockPaymentStatus.REJECTED ||
      payment.status === MockPaymentStatus.EXPIRED ||
      payment.status === MockPaymentStatus.REFUNDED_FULL ||
      payment.status === MockPaymentStatus.REFUNDED_PARTIAL
    ) {
      throw new BadRequestException(
        'No podés marcar como pendiente un pago mock en este estado',
      );
    }

    await this.mockPaymentProvider.updatePaymentStatus(
      paymentId,
      MockPaymentStatus.PENDING,
      'Pago mock pendiente',
    );
    await this.mockPaymentProvider.recordEvent({
      paymentId,
      eventType: this.mockPaymentProvider.getActionType('PEND'),
      status: MockPaymentStatus.PENDING,
    });
  }

  private async rejectOrExpireMockPayment(
    paymentId: string,
    mode: 'rejected' | 'expired',
  ): Promise<void> {
    const payment = await this.mockPaymentProvider.getPayment(paymentId);

    if (
      payment.status === MockPaymentStatus.APPROVED ||
      payment.status === MockPaymentStatus.REFUNDED_FULL ||
      payment.status === MockPaymentStatus.REFUNDED_PARTIAL
    ) {
      throw new BadRequestException(
        'No podés rechazar o expirar un pago mock ya aprobado o reintegrado',
      );
    }

    await this.prisma.ticket.deleteMany({
      where: {
        estado: 'RESERVADO',
        mpExternalReference: payment.reservationId,
      },
    });
    await this.socialPromotionsService.releaseReservedRedemptionByReservation(
      payment.reservationId,
    );

    const status =
      mode === 'rejected'
        ? MockPaymentStatus.REJECTED
        : MockPaymentStatus.EXPIRED;

    await this.mockPaymentProvider.updatePaymentStatus(
      paymentId,
      status,
      mode === 'rejected' ? 'Pago mock rechazado' : 'Pago mock expirado',
      {
        processedAt: new Date(),
      },
    );
    await this.mockPaymentProvider.recordEvent({
      paymentId,
      eventType: this.mockPaymentProvider.getActionType(
        mode === 'rejected' ? 'REJECT' : 'EXPIRE',
      ),
      status,
      metadata: {
        reservationId: payment.reservationId,
      },
    });
  }

  private async refundMockPayment(
    paymentId: string,
    amount?: number,
    markTicketsRefunded = false,
  ): Promise<void> {
    const payment = await this.mockPaymentProvider.getPayment(paymentId);

    if (payment.status !== MockPaymentStatus.APPROVED) {
      throw new BadRequestException(
        'Solo se puede reintegrar un pago mock aprobado',
      );
    }

    const normalizedAmount =
      typeof amount === 'number' && amount > 0
        ? Math.round(amount * 100) / 100
        : undefined;
    const isFullRefund =
      normalizedAmount === undefined ||
      normalizedAmount >=
        Number((Number(payment.cashChargedAmount) - 0.01).toFixed(2));

    const success = await this.refundPayment(paymentId, normalizedAmount);

    if (!success) {
      throw new BadRequestException('No se pudo procesar el reintegro mock');
    }

    if (markTicketsRefunded && isFullRefund) {
      await this.prisma.ticket.updateMany({
        where: {
          mpPaymentId: paymentId,
          estado: 'PAGADO',
        },
        data: { estado: 'REEMBOLSADO' },
      });
    }
  }

  // ==================== Webhook Handlers ====================

  /**
   * Processes a Mercado Pago payment webhook with idempotency and status routing.
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
    const paymentData = await this.mercadoPagoProvider.getPayment(paymentId);

    if (paymentData.status === 'approved') {
      await this.handlePaymentApproved(paymentData);
    } else {
      await this.handlePaymentReleasedOrExpired(paymentData);
    }

    // Mark as processed
    await this.prisma.mpEvent.create({
      data: {
        eventId: paymentId,
        eventType: `payment.${paymentData.status}`,
        metadata: JSON.parse(
          JSON.stringify(paymentData),
        ) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Pulls the latest payment state from the provider when webhook delivery is missing or delayed.
   */
  async syncPaymentStatus(paymentId: string): Promise<{
    status: string;
    alreadyProcessed: boolean;
    ticketsUpdated: number;
  }> {
    if (this.isMockPaymentId(paymentId)) {
      return this.mockPaymentProvider.syncPaymentStatus(paymentId);
    }

    try {
      // Check if already processed
      const existing = await this.prisma.mpEvent.findUnique({
        where: { eventId: paymentId },
      });

      if (existing) {
        this.logger.log(
          `Payment ${paymentId} already processed, skipping sync`,
        );
        return {
          status: 'approved',
          alreadyProcessed: true,
          ticketsUpdated: 0,
        };
      }

      const paymentData = await this.mercadoPagoProvider.getPayment(paymentId);

      if (paymentData.status === 'approved') {
        await this.handlePaymentApproved(paymentData);

        // Mark as processed
        await this.prisma.mpEvent.create({
          data: {
            eventId: paymentId,
            eventType: `payment.${paymentData.status}`,
            metadata: JSON.parse(
              JSON.stringify(paymentData),
            ) as Prisma.InputJsonValue,
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
      } else {
        await this.handlePaymentReleasedOrExpired(paymentData);
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
   * Finalizes an approved payment by confirming tickets, creating transactions,
   * and triggering downstream purchase side effects.
   */
  async handlePaymentApproved(paymentData: PaymentResponse): Promise<void> {
    const externalRef = paymentData.external_reference;
    if (!externalRef) {
      this.logger.warn('Payment approved but no external_reference found');
      return;
    }

    let refData: ExternalReferenceData;
    try {
      refData = JSON.parse(externalRef) as ExternalReferenceData;
    } catch {
      this.logger.error(`Failed to parse external_reference: ${externalRef}`);
      return;
    }

    const { raffleId, buyerId, cantidad: _cantidad } = refData;
    const reservationId = refData.reservationId;
    const bonusGrantId = refData.bonusGrantId ?? null;
    const promotionToken = refData.promotionToken ?? undefined;
    const purchaseMode = refData.purchaseMode ?? TicketPurchaseMode.RANDOM;
    const selectedNumbers = refData.selectedNumbers ?? null;
    const selectionPremiumPercent = Number(
      refData.selectionPremiumPercent ?? 0,
    );
    const selectionPremiumAmount = Number(refData.selectionPremiumAmount ?? 0);
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
      this.logger.log(
        `Transaction already exists for mpPaymentId ${mpPaymentId} (tx=${existingTx.id})`,
      );
      await this.checkRaffleCompletion(raffleId);
      return;
    }

    const totalAmount = Number(paymentData.transaction_amount ?? 0);
    const grossAmount = Number(refData.grossSubtotal ?? totalAmount);
    const promotionDiscountAmount = Number(refData.discountApplied ?? 0);
    const cashChargedAmount = Number(refData.mpChargeAmount ?? totalAmount);
    const platformFee = cashChargedAmount * this.platformFeeRate;
    const mpFee = Number(paymentData.fee_details?.[0]?.amount ?? 0);
    const netAmount = grossAmount - platformFee - mpFee;

    const transactionMetadata: Prisma.InputJsonValue = {
      externalReference: externalRef,
      reservationId: reservationId ?? null,
      bonusGrantId,
      promotionToken: promotionToken ?? null,
      purchaseMode,
      selectedNumbers,
      selectionPremiumPercent,
      selectionPremiumAmount,
      status: paymentData.status ?? null,
      statusDetail: paymentData.status_detail ?? null,
    };

    await this.prisma.transaction.create({
      data: {
        tipo: 'COMPRA_TICKET',
        userId: buyerId,
        raffleId,
        monto: cashChargedAmount,
        grossAmount,
        promotionDiscountAmount,
        cashChargedAmount,
        comisionPlataforma: platformFee,
        feeProcesamiento: mpFee,
        montoNeto: netAmount,
        mpPaymentId,
        estado: 'COMPLETADO',
        metadata: transactionMetadata,
      },
    });

    if (promotionDiscountAmount > 0) {
      await this.prisma.transaction.create({
        data: {
          tipo: 'SUBSIDIO_PROMOCIONAL_PLATAFORMA',
          userId: buyerId,
          raffleId,
          monto: promotionDiscountAmount,
          grossAmount,
          promotionDiscountAmount,
          cashChargedAmount,
          comisionPlataforma: 0,
          feeProcesamiento: 0,
          montoNeto: promotionDiscountAmount,
          estado: 'COMPLETADO',
          metadata: transactionMetadata,
        },
      });
    }

    await this.socialPromotionsService.markRedemptionUsedByReservation({
      reservationId,
      bonusGrantId,
      mpPaymentId,
    });

    await this.socialPromotionsService.recordPurchaseAttribution(
      buyerId,
      promotionToken,
      updatedTickets.count,
      grossAmount,
    );

    // Send notifications for ticket purchase
    try {
      const [buyer, raffle, tickets] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: buyerId },
          select: { email: true, nombre: true },
        }),
        this.prisma.raffle.findUnique({
          where: { id: raffleId },
          select: {
            id: true,
            titulo: true,
            sellerId: true,
            totalTickets: true,
            seller: {
              select: { id: true, email: true, nombre: true, apellido: true },
            },
            tickets: {
              where: { estado: 'PAGADO' },
              select: { id: true },
            },
          },
        }),
        this.prisma.ticket.findMany({
          where: { raffleId, buyerId, mpPaymentId },
          select: { id: true, numeroTicket: true },
        }),
      ]);

      if (buyer && raffle) {
        const ticketNumbers = tickets.map((t) => t.numeroTicket);

        // Send purchase confirmation email to buyer
        await this.notificationsService.sendTicketPurchaseConfirmation(
          buyer.email,
          {
            raffleName: raffle.titulo,
            ticketNumbers,
            amount: cashChargedAmount,
          },
        );

        // Create in-app notification for buyer
        await this.notificationsService.create(
          buyerId,
          'PURCHASE',
          '¡Compra confirmada!',
          `Compraste ${ticketNumbers.length} ticket(s) para "${raffle.titulo}". Números: ${ticketNumbers.join(', ')}`,
        );

        // Send notification to seller about the sale
        if (raffle.seller) {
          const soldTickets = raffle.tickets.length;
          const sellerName = `${raffle.seller.nombre} ${raffle.seller.apellido}`;

          // Send email notification to seller
          await this.notificationsService.sendSellerTicketPurchasedNotification(
            raffle.seller.email,
            {
              sellerName,
              raffleName: raffle.titulo,
              ticketCount: ticketNumbers.length,
              amount: cashChargedAmount,
              soldTickets,
              totalTickets: raffle.totalTickets,
              raffleId: raffle.id,
            },
          );

          // Create in-app notification for seller
          await this.notificationsService.create(
            raffle.seller.id,
            'INFO',
            '¡Nueva venta!',
            `Vendiste ${ticketNumbers.length} ticket(s) en "${raffle.titulo}" por $${cashChargedAmount.toFixed(2)}. Progreso: ${soldTickets}/${raffle.totalTickets}`,
          );
        }

        // Log activity
        await this.activityService.logTicketsPurchased(
          buyerId,
          raffleId,
          ticketNumbers,
          cashChargedAmount,
          mpPaymentId,
        );

        // Emit tickets purchased event for cross-cutting concerns
        this.eventEmitter.emit(
          RaffleEvents.TICKETS_PURCHASED,
          new TicketsPurchasedEvent(
            raffleId,
            buyerId,
            ticketNumbers.length,
            cashChargedAmount,
            mpPaymentId,
          ),
        );

        // Process referral reward if this is the user's first purchase
        this.referralsService
          .processFirstPurchaseReward(
            buyerId,
            cashChargedAmount,
            tickets[0]?.id,
          )
          .catch((err: unknown) => {
            const errorMsg = isErrorWithMessage(err)
              ? err.message
              : 'Unknown error';
            this.logger.error(`Failed to process referral reward: ${errorMsg}`);
          });
      }
    } catch (notifError: unknown) {
      // Don't fail payment processing if notifications fail
      const errorMsg = isErrorWithMessage(notifError)
        ? notifError.message
        : 'Unknown error';
      this.logger.error(`Failed to send purchase notifications: ${errorMsg}`);
    }

    // Check raffle completion
    await this.checkRaffleCompletion(raffleId);
  }

  // ==================== Transfers to Sellers ====================

  /**
   * Records a manual seller transfer for the legacy payout flow.
   */
  async transferToSeller(
    raffleId: string,
  ): Promise<{ netAmount: number; totalAmount: number } | null> {
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

    const { netAmount, platformFee, mpFee } =
      this.calculateCommissions(totalAmount);

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
   * Refunds a payment through the active provider and restores promotion bonus state when needed.
   */
  async refundPayment(mpPaymentId: string, amount?: number): Promise<boolean> {
    try {
      const normalizedAmount =
        typeof amount === 'number' && amount > 0
          ? Math.round(amount * 100) / 100
          : undefined;

      if (
        this.isMockPaymentId(mpPaymentId) ||
        this.paymentsProvider === 'mock'
      ) {
        this.logger.log(
          `[MOCK] Refund processed for payment ${mpPaymentId}${normalizedAmount ? ` (amount: ${normalizedAmount})` : ''}`,
        );
        const mockPayment =
          await this.mockPaymentProvider.getPayment(mpPaymentId);
        const isFullRefund =
          normalizedAmount === undefined ||
          normalizedAmount >=
            Number((Number(mockPayment.cashChargedAmount) - 0.01).toFixed(2));

        await this.socialPromotionsService.reinstateRedemptionByPaymentId(
          mpPaymentId,
          normalizedAmount,
        );
        await this.mockPaymentProvider.updatePaymentStatus(
          mpPaymentId,
          isFullRefund
            ? MockPaymentStatus.REFUNDED_FULL
            : MockPaymentStatus.REFUNDED_PARTIAL,
          isFullRefund
            ? 'Pago mock reintegrado totalmente'
            : 'Pago mock reintegrado parcialmente',
          {
            refundedAt: new Date(),
            refundedAmount:
              normalizedAmount ?? Number(mockPayment.cashChargedAmount),
          },
        );
        await this.mockPaymentProvider.recordEvent({
          paymentId: mpPaymentId,
          eventType: this.mockPaymentProvider.getActionType(
            isFullRefund ? 'REFUND_FULL' : 'REFUND_PARTIAL',
          ),
          status: isFullRefund
            ? MockPaymentStatus.REFUNDED_FULL
            : MockPaymentStatus.REFUNDED_PARTIAL,
          amount: normalizedAmount ?? Number(mockPayment.cashChargedAmount),
          metadata: {
            reservationId: mockPayment.reservationId,
          },
        });
        return true;
      }

      await this.mercadoPagoProvider.refundPayment(
        mpPaymentId,
        normalizedAmount,
      );

      this.logger.log(
        `Refund processed for payment ${mpPaymentId}${normalizedAmount ? ` (amount: ${normalizedAmount})` : ''}`,
      );
      await this.socialPromotionsService.reinstateRedemptionByPaymentId(
        mpPaymentId,
        normalizedAmount,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Refund failed for ${mpPaymentId}: ${message}`);
      return false;
    }
  }

  /**
   * Releases any reserved promotion redemption tied to a payment that did not end up approved.
   */
  private async handlePaymentReleasedOrExpired(
    paymentData: PaymentResponse,
  ): Promise<void> {
    const externalRef = paymentData.external_reference;
    if (!externalRef) {
      return;
    }

    try {
      const refData = JSON.parse(externalRef) as ExternalReferenceData;
      if (refData.reservationId) {
        await this.socialPromotionsService.releaseReservedRedemptionByReservation(
          refData.reservationId,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to release social promotion redemption for non-approved payment ${paymentData.id}: ${message}`,
      );
    }
  }

  // ==================== Fund Release (Delayed Disbursement) ====================

  /**
   * Releases delayed-disbursement funds for all paid tickets in a raffle once payout conditions are met.
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
      return {
        success: false,
        releasedPayments: 0,
        errors: ['No hay pagos para liberar'],
      };
    }

    if (this.paymentsProvider === 'mock') {
      const releasedPayments = tickets.length;
      await this.prisma.raffle.update({
        where: { id: raffleId },
        data: { paymentReleasedAt: new Date() },
      });
      this.logger.log(
        `[MOCK] Released ${releasedPayments} payments for raffle ${raffleId}`,
      );
      return { success: true, releasedPayments, errors: [] };
    }

    // Release each payment
    for (const ticket of tickets) {
      if (!ticket.mpPaymentId) continue;

      try {
        await this.mercadoPagoProvider.releasePayment(ticket.mpPaymentId);
        releasedPayments++;
        this.logger.log(`Released funds for payment ${ticket.mpPaymentId}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Payment ${ticket.mpPaymentId}: ${message}`);
        this.logger.error(
          `Exception releasing payment ${ticket.mpPaymentId}: ${message}`,
        );
      }
    }

    const success = releasedPayments > 0 && errors.length === 0;

    if (success) {
      // Update raffle to mark payment as released
      await this.prisma.raffle.update({
        where: { id: raffleId },
        data: { paymentReleasedAt: new Date() },
      });

      this.logger.log(
        `Released ${releasedPayments} payments for raffle ${raffleId}`,
      );
    }

    return { success, releasedPayments, errors };
  }

  /**
   * Checks whether a raffle is eligible for fund release.
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

    if (
      raffle.dispute &&
      !['RESUELTA_VENDEDOR', 'RESUELTA_PARCIAL'].includes(raffle.dispute.estado)
    ) {
      return { canRelease: false, reason: 'Hay una disputa activa' };
    }

    if (raffle.deliveryStatus !== 'CONFIRMED') {
      return { canRelease: false, reason: 'La entrega no ha sido confirmada' };
    }

    if (!['SORTEADA', 'EN_ENTREGA', 'FINALIZADA'].includes(raffle.estado)) {
      return {
        canRelease: false,
        reason: `Estado de rifa no válido: ${raffle.estado}`,
      };
    }

    return { canRelease: true, reason: 'OK' };
  }

  // ==================== Calculations ====================

  /**
   * Estimates Mercado Pago processing fees for a given amount.
   */
  calculateMpFees(amount: number): number {
    return amount * MP_FEE_ESTIMATE_RATE;
  }

  /**
   * Splits a gross amount into platform fee, processing fee, and seller net amount.
   */
  calculateCommissions(totalAmount: number) {
    const platformFee = totalAmount * this.platformFeeRate;
    const mpFee = this.calculateMpFees(totalAmount);
    const totalFees = platformFee + mpFee;
    const netAmount = totalAmount - totalFees;

    return { platformFee, mpFee, totalFees, netAmount };
  }

  // ==================== Idempotency ====================

  /**
   * Checks whether a Mercado Pago event has already been persisted for idempotency.
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const event = await this.prisma.mpEvent.findUnique({
      where: { eventId },
    });
    return !!event;
  }

  /**
   * Persists a processed Mercado Pago event marker for idempotency.
   */
  async markEventProcessed(eventId: string, eventType: string): Promise<void> {
    await this.prisma.mpEvent.create({
      data: {
        eventId,
        eventType,
      },
    });
  }

  // ==================== Helper Methods ====================

  /**
   * Draws a winner once a raffle is complete and has paid tickets, then triggers draw side effects.
   */
  async drawRaffleIfEligible(raffleId: string): Promise<boolean> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: {
        product: true,
        seller: true,
        winner: true,
        drawResult: true,
        tickets: {
          where: { estado: 'PAGADO' },
          include: { buyer: true },
        },
      },
    });

    if (!raffle || raffle.isDeleted) {
      return false;
    }

    if (!['ACTIVA', 'COMPLETADA'].includes(raffle.estado)) {
      return false;
    }

    if (raffle.drawResult || raffle.winnerId) {
      return false;
    }

    if (raffle.tickets.length === 0) {
      this.logger.warn(`No paid tickets for raffle ${raffleId}, cannot draw`);
      return false;
    }

    const randomIndex = Math.floor(Math.random() * raffle.tickets.length);
    const winningTicket = raffle.tickets[randomIndex];

    try {
      const updatedRaffle = await this.prisma.$transaction(async (tx) => {
        await tx.drawResult.create({
          data: {
            raffleId,
            winningTicketId: winningTicket.id,
            winnerId: winningTicket.buyerId,
            method: 'RANDOM_INDEX',
            totalParticipants: raffle.tickets.length,
          },
        });

        return tx.raffle.update({
          where: { id: raffleId },
          data: {
            estado: 'SORTEADA',
            winnerId: winningTicket.buyerId,
            fechaSorteoReal: new Date(),
          },
          include: { product: true, seller: true, winner: true },
        });
      });

      this.eventEmitter.emit(
        RaffleEvents.DRAWN,
        new RaffleDrawnEvent(
          raffleId,
          winningTicket.buyerId,
          winningTicket.numeroTicket,
          raffle.sellerId,
        ),
      );

      this.notifyDrawResult(updatedRaffle, winningTicket.numeroTicket).catch(
        (err: unknown) => {
          const message = isErrorWithMessage(err)
            ? err.message
            : 'Unknown error';
          this.logger.error(
            `Failed to send draw notifications for ${raffleId}: ${message}`,
          );
        },
      );

      this.payoutsService.createPayout(raffleId).catch((err: unknown) => {
        const message = isErrorWithMessage(err) ? err.message : 'Unknown error';
        this.logger.error(
          `Failed to create payout for raffle ${raffleId}: ${message}`,
        );
      });

      return true;
    } catch (error: unknown) {
      const prismaCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : undefined;

      if (prismaCode === 'P2002') {
        this.logger.warn(`Draw for raffle ${raffleId} was already persisted`);
        return false;
      }

      throw error;
    }
  }

  private async notifyDrawResult(
    raffle: {
      id: string;
      titulo: string;
      sellerId: string;
      seller: { id: string; email: string };
      winnerId: string | null;
      winner: { id: string; email: string } | null;
      product: { nombre: string } | null;
    },
    winningTicketNumber: number,
  ): Promise<void> {
    if (!raffle.winner || !raffle.winnerId) {
      return;
    }

    await Promise.all([
      this.notificationsService.sendWinnerNotification(raffle.winner.email, {
        raffleName: raffle.titulo,
        productName: raffle.product?.nombre || raffle.titulo,
        sellerEmail: raffle.seller.email,
        winningTicketNumber,
      }),
      this.notificationsService.create(
        raffle.winnerId,
        'WIN',
        '🎉 ¡Has ganado un sorteo!',
        `¡Felicidades! Ganaste la rifa "${raffle.titulo}" con el número #${winningTicketNumber}. Contactá al vendedor para coordinar la entrega.`,
      ),
      this.notificationsService.sendSellerMustContactWinner(
        raffle.seller.email,
        {
          raffleName: raffle.titulo,
          winnerEmail: raffle.winner.email,
          winningTicketNumber,
        },
      ),
      this.notificationsService.create(
        raffle.seller.id,
        'INFO',
        'Tu rifa tiene ganador',
        `La rifa "${raffle.titulo}" ha finalizado. El número ganador fue el #${winningTicketNumber}. Tenés 48hs para contactar al ganador.`,
      ),
    ]);
  }

  private async checkRaffleCompletion(raffleId: string) {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: { tickets: true },
    });

    if (!raffle) return;

    const paidTickets = raffle.tickets.filter((t) => t.estado === 'PAGADO');
    const paidTicketCount = paidTickets.length;

    if (paidTicketCount >= raffle.totalTickets) {
      this.logger.log(
        `Raffle ${raffleId} is now COMPLETADA (100% tickets sold)`,
      );

      if (raffle.estado === 'ACTIVA') {
        await this.prisma.raffle.update({
          where: { id: raffleId },
          data: { estado: 'COMPLETADA' },
        });

        // Calculate total amount from tickets
        const totalAmount = paidTickets.reduce(
          (sum, t) => sum + Number(t.precioPagado),
          0,
        );

        // Emit raffle completed event for cross-cutting concerns
        this.eventEmitter.emit(
          RaffleEvents.COMPLETED,
          new RaffleCompletedEvent(
            raffleId,
            raffle.sellerId,
            paidTicketCount,
            totalAmount,
          ),
        );
      }

      await this.drawRaffleIfEligible(raffleId);
    }
  }
}
