import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MockPaymentEventType,
  MockPaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  MockPaymentAction,
  MockPaymentSummary,
  PaymentStatusResult,
  SyncStatusResult,
} from './payment-provider.types';

/**
 * Provides a local payment backend that mimics checkout, status changes, and refunds for QA flows.
 */
@Injectable()
export class MockPaymentProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeBaseUrl(
    value: string | undefined | null,
    fallback: string,
  ): string {
    const raw = (value || '').trim();
    const base = raw.length ? raw : fallback;
    const withScheme = /^https?:\/\//i.test(base) ? base : `http://${base}`;
    return withScheme.replace(/\/$/, '');
  }

  /**
   * Returns whether mock payments are enabled by environment configuration.
   */
  isEnabled(): boolean {
    const provider = (
      this.configService.get<string>('PAYMENTS_PROVIDER') || ''
    ).trim();
    const legacyMockMode = this.configService.get<boolean | string>(
      'MP_MOCK_MODE',
    );
    const legacyEnabled =
      legacyMockMode === true ||
      (typeof legacyMockMode === 'string' &&
        legacyMockMode.trim().toLowerCase() === 'true');

    return provider.toLowerCase() === 'mock' || legacyEnabled;
  }

  /**
   * Guards mutating mock-payment operations when the feature is disabled.
   */
  assertEnabled(): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const allowInProduction =
      this.configService.get<boolean | string>('ALLOW_MOCK_PAYMENTS') ===
        true ||
      String(
        this.configService.get<boolean | string>('ALLOW_MOCK_PAYMENTS') ?? '',
      )
        .trim()
        .toLowerCase() === 'true';

    if (!this.isEnabled() || (isProduction && !allowInProduction)) {
      throw new ForbiddenException('Mock payments no están habilitados');
    }
  }

  private buildExternalReference(data: CreateCheckoutSessionInput): string {
    return JSON.stringify({
      raffleId: data.raffleId,
      buyerId: data.buyerId,
      cantidad: data.cantidad,
      reservationId: data.reservationId,
      bonusGrantId: data.bonusGrantId ?? null,
      grossSubtotal: data.grossSubtotal,
      discountApplied: data.discountApplied,
      mpChargeAmount: data.cashChargedAmount,
      promotionToken: data.promotionToken ?? null,
      purchaseMode: data.purchaseMode,
      selectedNumbers: data.selectedNumbers ?? null,
      selectionPremiumPercent: data.selectionPremiumPercent,
      selectionPremiumAmount: data.selectionPremiumAmount,
    });
  }

  private mapStatus(status: MockPaymentStatus): string {
    switch (status) {
      case MockPaymentStatus.APPROVED:
        return 'approved';
      case MockPaymentStatus.PENDING:
        return 'pending';
      case MockPaymentStatus.REJECTED:
        return 'rejected';
      case MockPaymentStatus.EXPIRED:
        return 'expired';
      case MockPaymentStatus.REFUNDED_FULL:
        return 'refunded';
      case MockPaymentStatus.REFUNDED_PARTIAL:
        return 'partially_refunded';
      case MockPaymentStatus.INITIATED:
      default:
        return 'initiated';
    }
  }

  /**
   * Creates a local checkout session and persists the mock payment record.
   */
  async createCheckoutSession(
    data: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    this.assertEnabled();

    const frontendUrl = this.normalizeBaseUrl(
      this.configService.get<string>('FRONTEND_URL'),
      'http://localhost:3000',
    );
    const paymentId = `mock_pay_${randomUUID().replace(/-/g, '')}`;
    const publicToken = randomUUID().replace(/-/g, '');
    const merchantOrderId = `mock_order_${Date.now()}`;

    await this.prisma.mockPayment.create({
      data: {
        id: paymentId,
        publicToken,
        buyerId: data.buyerId,
        raffleId: data.raffleId,
        reservationId: data.reservationId,
        grossSubtotal: data.grossSubtotal,
        discountApplied: data.discountApplied,
        cashChargedAmount: data.cashChargedAmount,
        promotionBonusGrantId: data.bonusGrantId ?? null,
        promotionBonusRedemptionId: data.promotionBonusRedemptionId ?? null,
        providerReference: paymentId,
        merchantOrderId,
        externalReference: this.buildExternalReference(data),
        status: MockPaymentStatus.INITIATED,
        statusDetail: 'Checkout mock iniciado',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    return {
      initPoint: `${frontendUrl}/checkout/mock/${paymentId}?token=${publicToken}`,
      preferenceId: paymentId,
    };
  }

  /**
   * Returns normalized status data for a stored mock payment.
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    const payment = await this.prisma.mockPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pago mock no encontrado');
    }

    return {
      status: this.mapStatus(payment.status),
      statusDetail: payment.statusDetail || '',
      externalReference: payment.externalReference || null,
      merchantOrderId: payment.merchantOrderId,
    };
  }

  /**
   * Returns the latest mock payment status plus whether ticket confirmation already happened.
   */
  async syncPaymentStatus(paymentId: string): Promise<SyncStatusResult> {
    const payment = await this.prisma.mockPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pago mock no encontrado');
    }

    const ticketsUpdated =
      payment.status === MockPaymentStatus.APPROVED
        ? await this.prisma.ticket.count({
            where: {
              mpPaymentId: paymentId,
            },
          })
        : 0;

    return {
      status: this.mapStatus(payment.status),
      alreadyProcessed: Boolean(payment.processedAt),
      ticketsUpdated,
    };
  }

  /**
   * Loads the raw stored mock payment record.
   */
  async getPayment(paymentId: string) {
    const payment = await this.prisma.mockPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Pago mock no encontrado');
    }

    return payment;
  }

  /**
   * Loads the mock payment summary exposed to the browser checkout screen.
   */
  async getPaymentForCheckout(
    paymentId: string,
    publicToken: string,
  ): Promise<MockPaymentSummary> {
    this.assertEnabled();

    const payment = await this.prisma.mockPayment.findFirst({
      where: {
        id: paymentId,
        publicToken,
      },
    });

    if (!payment) {
      throw new NotFoundException('Pago mock no encontrado');
    }

    const [raffle, buyer, quantity] = await Promise.all([
      this.prisma.raffle.findUnique({
        where: { id: payment.raffleId },
        select: { titulo: true },
      }),
      this.prisma.user.findUnique({
        where: { id: payment.buyerId },
        select: { email: true },
      }),
      this.prisma.ticket.count({
        where: { mpExternalReference: payment.reservationId },
      }),
    ]);

    return {
      id: payment.id,
      publicToken: payment.publicToken,
      raffleId: payment.raffleId,
      raffleTitle: raffle?.titulo ?? 'Rifa',
      buyerId: payment.buyerId,
      buyerEmail: buyer?.email ?? 'desconocido',
      quantity,
      grossSubtotal: Number(payment.grossSubtotal),
      discountApplied: Number(payment.discountApplied),
      cashChargedAmount: Number(payment.cashChargedAmount),
      purchaseMode: ((
        JSON.parse(payment.externalReference || '{}') as {
          purchaseMode?: MockPaymentSummary['purchaseMode'];
        }
      ).purchaseMode ?? 'RANDOM') as MockPaymentSummary['purchaseMode'],
      selectedNumbers: (
        JSON.parse(payment.externalReference || '{}') as {
          selectedNumbers?: number[] | null;
        }
      ).selectedNumbers,
      selectionPremiumPercent: Number(
        (
          JSON.parse(payment.externalReference || '{}') as {
            selectionPremiumPercent?: number;
          }
        ).selectionPremiumPercent ?? 0,
      ),
      selectionPremiumAmount: Number(
        (
          JSON.parse(payment.externalReference || '{}') as {
            selectionPremiumAmount?: number;
          }
        ).selectionPremiumAmount ?? 0,
      ),
      status: this.mapStatus(payment.status),
      statusDetail: payment.statusDetail || '',
      merchantOrderId: payment.merchantOrderId,
      promotionBonusGrantId: payment.promotionBonusGrantId,
      promotionBonusRedemptionId: payment.promotionBonusRedemptionId,
      createdAt: payment.createdAt.toISOString(),
      approvedAt: payment.approvedAt?.toISOString() ?? null,
      refundedAt: payment.refundedAt?.toISOString() ?? null,
    };
  }

  /**
   * Persists a new mock payment status and any related metadata changes.
   */
  async updatePaymentStatus(
    paymentId: string,
    status: MockPaymentStatus,
    statusDetail: string,
    data?: Prisma.MockPaymentUpdateInput,
  ) {
    return this.prisma.mockPayment.update({
      where: { id: paymentId },
      data: {
        status,
        statusDetail,
        ...data,
      },
    });
  }

  /**
   * Persists an audit event for a mock payment action.
   */
  async recordEvent(params: {
    paymentId: string;
    eventType: MockPaymentEventType;
    status: MockPaymentStatus;
    amount?: number;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.mockPaymentEvent.create({
      data: {
        mockPaymentId: params.paymentId,
        eventType: params.eventType,
        status: params.status,
        amount: params.amount,
        metadata: params.metadata,
      },
    });
  }

  /**
   * Maps a UI action to the corresponding mock payment event type.
   */
  getActionType(action: MockPaymentAction): MockPaymentEventType {
    switch (action) {
      case 'APPROVE':
        return MockPaymentEventType.APPROVE;
      case 'PEND':
        return MockPaymentEventType.PEND;
      case 'REJECT':
        return MockPaymentEventType.REJECT;
      case 'REFUND_FULL':
        return MockPaymentEventType.REFUND_FULL;
      case 'REFUND_PARTIAL':
        return MockPaymentEventType.REFUND_PARTIAL;
      case 'EXPIRE':
      default:
        return MockPaymentEventType.EXPIRE;
    }
  }
}
