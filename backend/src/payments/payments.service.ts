import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreditTopUpStatus,
  PaymentsProvider,
  Prisma,
  WalletLedgerEntryType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { getPlatformFeeRate } from '../common/config/platform-fee.util';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import {
  MercadoPagoTopUpProvider,
  MercadoPagoWebhookPayload,
} from './providers/mercado-pago-topup.provider';
import { captureException } from '../sentry';
import type {
  MockTopUpAction,
  MockTopUpActionResult,
  MockTopUpSummary,
  ProviderTopUpDetails,
  SyncTopUpStatusResult,
} from './providers/payment-provider.types';

interface CreditTopUpReference {
  topUpSessionId: string;
  userId: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly platformFeeRate: number;
  private readonly paymentsProvider: 'mercado_pago' | 'mock';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly mercadoPagoProvider: MercadoPagoTopUpProvider,
    private readonly mockPaymentProvider: MockPaymentProvider,
    private readonly notificationsService: NotificationsService,
    private readonly activityService: ActivityService,
  ) {
    const explicitProvider = (
      this.configService.get<string>('PAYMENTS_PROVIDER') || ''
    )
      .trim()
      .toLowerCase();
    this.paymentsProvider =
      explicitProvider === 'mock' ? 'mock' : 'mercado_pago';

    if (
      this.paymentsProvider === 'mercado_pago' &&
      !this.mercadoPagoProvider.isConfigured()
    ) {
      throw new Error(
        'PAYMENTS_PROVIDER=mercado_pago pero falta MP_ACCESS_TOKEN',
      );
    }

    if (this.paymentsProvider === 'mock') {
      this.logger.warn('Payment provider service in MOCK mode');
    }

    this.platformFeeRate = getPlatformFeeRate(this.configService);
  }

  async createCreditTopUp(userId: string, amount: number) {
    const normalizedAmount = this.normalizeAmount(amount);
    const providerReference = `luk_topup_${randomUUID().replace(/-/g, '')}`;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, nombre: true, apellido: true },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const topUp = await this.prisma.creditTopUpSession.create({
      data: {
        userId,
        provider:
          this.paymentsProvider === 'mock'
            ? PaymentsProvider.MOCK
            : PaymentsProvider.MERCADO_PAGO,
        providerReference,
        amount: normalizedAmount,
        externalReference: JSON.stringify({ topUpSessionId: '', userId }),
        metadata: {
          purpose: 'luk_credit_top_up',
        },
      },
    });

    const externalReference = JSON.stringify({
      topUpSessionId: topUp.id,
      userId,
    } satisfies CreditTopUpReference);

    await this.prisma.creditTopUpSession.update({
      where: { id: topUp.id },
      data: { externalReference },
    });

    const providerInput = {
      topUpSessionId: topUp.id,
      userId,
      amount: normalizedAmount,
      providerReference,
      buyerProfile: {
        email: user.email,
        firstName: user.nombre,
        lastName: user.apellido,
      },
    };

    const session =
      this.paymentsProvider === 'mock'
        ? await this.mockPaymentProvider.createCreditTopUp(providerInput)
        : await this.mercadoPagoProvider.createCreditTopUp(providerInput);

    await this.prisma.creditTopUpSession.update({
      where: { id: topUp.id },
      data: {
        redirectUrl: session.redirectUrl,
        providerOrderId: session.providerSessionId,
      },
    });

    await this.activityService.logCreditTopUpCreated(
      userId,
      topUp.id,
      normalizedAmount,
      {
        provider:
          this.paymentsProvider === 'mock'
            ? PaymentsProvider.MOCK
            : PaymentsProvider.MERCADO_PAGO,
        providerReference,
      },
    );

    return {
      id: topUp.id,
      amount: normalizedAmount,
      redirectUrl: session.redirectUrl,
      status: 'initiated',
    };
  }

  async getPaymentStatus(paymentId: string) {
    if (this.isMockTopUpId(paymentId)) {
      return this.mockPaymentProvider.getTopUpStatus(paymentId);
    }

    return this.mercadoPagoProvider.getTopUpStatus(paymentId);
  }

  async getMockPaymentForCheckout(
    topUpSessionId: string,
    publicToken: string,
  ): Promise<MockTopUpSummary> {
    return this.mockPaymentProvider.getTopUpForCheckout(
      topUpSessionId,
      publicToken,
    );
  }

  async processMockPaymentAction(
    topUpSessionId: string,
    publicToken: string,
    action: MockTopUpAction,
    amount?: number,
  ): Promise<MockTopUpActionResult> {
    await this.mockPaymentProvider.getTopUpForCheckout(
      topUpSessionId,
      publicToken,
    );

    switch (action) {
      case 'APPROVE':
        await this.approveMockTopUp(topUpSessionId);
        break;
      case 'PEND':
        await this.markMockTopUpPending(topUpSessionId);
        break;
      case 'REJECT':
        await this.rejectOrExpireMockTopUp(topUpSessionId, 'rejected');
        break;
      case 'EXPIRE':
        await this.rejectOrExpireMockTopUp(topUpSessionId, 'expired');
        break;
      case 'REFUND_FULL':
        await this.refundCreditTopUp(topUpSessionId);
        break;
      case 'REFUND_PARTIAL':
        if (typeof amount !== 'number' || amount <= 0) {
          throw new BadRequestException(
            'Debes indicar un monto válido para el reintegro parcial',
          );
        }
        await this.refundCreditTopUp(topUpSessionId, amount);
        break;
      default:
        throw new BadRequestException('Acción mock no soportada');
    }

    const refreshed = await this.getPaymentStatus(topUpSessionId);
    const topUp = await this.mockPaymentProvider.getTopUp(topUpSessionId);

    return {
      topUpSessionId,
      status: refreshed.status,
      providerOrderId: refreshed.providerOrderId || topUp.providerOrderId || '',
      redirectUrl: this.buildStatusRedirectUrl(
        topUpSessionId,
        refreshed.status,
        refreshed.providerOrderId || topUp.providerOrderId || '',
        publicToken,
      ),
      mockToken: publicToken,
    };
  }

  async handleProviderWebhook(
    payload: MercadoPagoWebhookPayload,
  ): Promise<void> {
    const normalized = this.mercadoPagoProvider.normalizeWebhook(payload);
    if (!normalized?.paymentId) {
      this.logger.log('Ignoring provider webhook without payment id');
      return;
    }

    const eventId = `${normalized.eventType}:${normalized.paymentId}`;
    const existing = await this.prisma.paymentProviderEvent.findUnique({
      where: { eventId },
    });

    if (existing) {
      return;
    }

    await this.syncPaymentStatus(normalized.paymentId);

    await this.prisma.paymentProviderEvent.create({
      data: {
        eventId,
        eventType: normalized.eventType,
        metadata: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
      },
    });
  }

  async syncPaymentStatus(paymentId: string): Promise<SyncTopUpStatusResult> {
    if (this.isMockTopUpId(paymentId)) {
      return this.mockPaymentProvider.syncTopUpStatus(paymentId);
    }

    const existing = await this.prisma.paymentProviderEvent.findUnique({
      where: { eventId: paymentId },
    });
    const providerTopUp = await this.mercadoPagoProvider.getTopUp(paymentId);

    if (providerTopUp.status === 'approved') {
      await this.approveProviderTopUp(providerTopUp);
    } else {
      await this.updateTopUpFromProvider(providerTopUp);
    }

    if (!existing) {
      await this.prisma.paymentProviderEvent.create({
        data: {
          eventId: paymentId,
          eventType: `top_up.${providerTopUp.status}`,
          metadata: JSON.parse(
            JSON.stringify(providerTopUp),
          ) as Prisma.InputJsonValue,
        },
      });
    }

    return {
      status: providerTopUp.status,
      alreadyProcessed: Boolean(existing),
      creditedAmount:
        providerTopUp.status === 'approved' ? providerTopUp.amount : 0,
    };
  }

  async refundCreditTopUp(
    topUpSessionId: string,
    amount?: number,
  ): Promise<boolean> {
    try {
      const topUp = await this.prisma.creditTopUpSession.findUnique({
        where: { id: topUpSessionId },
      });

      if (!topUp || topUp.status !== CreditTopUpStatus.APPROVED) {
        throw new BadRequestException('La carga no está aprobada');
      }

      const wallet = await this.walletService.ensureWalletAccount(
        this.prisma,
        topUp.userId,
      );
      const remainingTopUpAmount =
        Number(topUp.creditedAmount) - Number(topUp.refundedAmount);
      const refundAmount = this.normalizeAmount(amount ?? remainingTopUpAmount);

      if (refundAmount > remainingTopUpAmount + 0.00001) {
        throw new BadRequestException(
          'No podés reintegrar más que el saldo disponible de esta carga',
        );
      }

      if (refundAmount > Number(wallet.creditBalance) + 0.00001) {
        throw new BadRequestException(
          'No podés reintegrar saldo que ya fue usado',
        );
      }

      if (topUp.provider === PaymentsProvider.MERCADO_PAGO) {
        if (!topUp.providerPaymentId) {
          throw new BadRequestException(
            'La carga no tiene payment id de Mercado Pago',
          );
        }
        await this.mercadoPagoProvider.refundTopUp(
          topUp.providerPaymentId,
          refundAmount >= remainingTopUpAmount ? undefined : refundAmount,
        );
      }

      const nextRefundedAmount = Number(topUp.refundedAmount) + refundAmount;
      const fullRefund =
        nextRefundedAmount >= Number(topUp.creditedAmount) - 0.00001;

      await this.prisma.$transaction(async (tx) => {
        await this.walletService.debitUserBalance(
          tx,
          topUp.userId,
          refundAmount,
          WalletLedgerEntryType.CREDIT_TOP_UP_REFUND,
          {
            creditTopUpSessionId: topUp.id,
            metadata: { provider: topUp.provider },
          },
        );

        await tx.creditTopUpSession.update({
          where: { id: topUp.id },
          data: {
            refundedAmount: nextRefundedAmount,
            refundedAt: new Date(),
            status: fullRefund
              ? CreditTopUpStatus.REFUNDED_FULL
              : CreditTopUpStatus.REFUNDED_PARTIAL,
            statusDetail: fullRefund
              ? 'Carga reintegrada totalmente'
              : 'Carga reintegrada parcialmente',
          },
        });
      });

      await this.notifyCreditTopUpRefunded({
        userId: topUp.userId,
        topUpSessionId: topUp.id,
        amount: refundAmount,
        fullRefund,
        provider: topUp.provider,
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Top-up refund failed: ${message}`);
      captureException(
        error instanceof Error ? error : new Error('Top-up refund failed'),
        {
          tags: {
            service: 'luk-backend',
            domain: 'payments',
            stage: 'top-up-refund',
          },
          extra: { topUpSessionId, amount },
        },
      );
      return false;
    }
  }

  calculateCommissions(totalAmount: number) {
    const platformFee = totalAmount * this.platformFeeRate;
    const processingFee = 0;
    const netAmount = totalAmount - platformFee - processingFee;
    return { platformFee, processingFee, netAmount };
  }

  async canReleaseFunds(raffleId: string): Promise<{
    canRelease: boolean;
    reason: string;
  }> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      select: {
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
    if (raffle.deliveryStatus !== 'CONFIRMED') {
      return { canRelease: false, reason: 'Entrega no confirmada' };
    }
    if (
      raffle.dispute &&
      ['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'].includes(
        raffle.dispute.estado,
      )
    ) {
      return { canRelease: false, reason: 'Hay una disputa activa' };
    }

    return { canRelease: true, reason: 'Fondos listos para liberar' };
  }

  private async approveMockTopUp(topUpSessionId: string): Promise<void> {
    const topUp = await this.mockPaymentProvider.getTopUp(topUpSessionId);
    if (topUp.processedAt) {
      return;
    }

    if (
      topUp.status === CreditTopUpStatus.REJECTED ||
      topUp.status === CreditTopUpStatus.EXPIRED ||
      topUp.status === CreditTopUpStatus.REFUNDED_FULL ||
      topUp.status === CreditTopUpStatus.REFUNDED_PARTIAL
    ) {
      throw new BadRequestException(
        'No podés aprobar una carga mock en este estado',
      );
    }

    await this.approveProviderTopUp({
      providerPaymentId: topUp.id,
      status: 'approved',
      statusDetail: 'mock_approved',
      amount: Number(topUp.amount),
      externalReference: topUp.providerReference,
      providerOrderId: topUp.providerOrderId,
      processingFee: 0,
    });

    await this.mockPaymentProvider.recordEvent({
      topUpSessionId,
      eventType: this.mockPaymentProvider.getActionType('APPROVE'),
      status: CreditTopUpStatus.APPROVED,
      metadata: { provider: 'mock' },
    });
  }

  private async markMockTopUpPending(topUpSessionId: string): Promise<void> {
    await this.mockPaymentProvider.updateTopUpStatus(
      topUpSessionId,
      CreditTopUpStatus.PENDING,
      'Carga mock pendiente',
    );
    await this.mockPaymentProvider.recordEvent({
      topUpSessionId,
      eventType: this.mockPaymentProvider.getActionType('PEND'),
      status: CreditTopUpStatus.PENDING,
    });
  }

  private async rejectOrExpireMockTopUp(
    topUpSessionId: string,
    mode: 'rejected' | 'expired',
  ): Promise<void> {
    const status =
      mode === 'rejected'
        ? CreditTopUpStatus.REJECTED
        : CreditTopUpStatus.EXPIRED;
    await this.mockPaymentProvider.updateTopUpStatus(
      topUpSessionId,
      status,
      mode === 'rejected' ? 'Carga mock rechazada' : 'Carga mock expirada',
      { processedAt: new Date() },
    );
    await this.mockPaymentProvider.recordEvent({
      topUpSessionId,
      eventType: this.mockPaymentProvider.getActionType(
        mode === 'rejected' ? 'REJECT' : 'EXPIRE',
      ),
      status,
    });

    const topUp = await this.prisma.creditTopUpSession.findUnique({
      where: { id: topUpSessionId },
      select: {
        id: true,
        userId: true,
        amount: true,
        provider: true,
        statusDetail: true,
      },
    });

    if (topUp) {
      await this.notifyCreditTopUpFailed({
        userId: topUp.userId,
        topUpSessionId: topUp.id,
        amount: Number(topUp.amount),
        provider: topUp.provider,
        status,
        statusDetail: topUp.statusDetail,
      });
    }
  }

  private async approveProviderTopUp(
    providerTopUp: ProviderTopUpDetails,
  ): Promise<void> {
    const topUp = await this.findTopUpForProvider(providerTopUp);
    if (!topUp || topUp.processedAt) {
      return;
    }

    const processedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.walletService.creditUserBalance(
        tx,
        topUp.userId,
        providerTopUp.amount,
        WalletLedgerEntryType.CREDIT_TOP_UP,
        {
          creditTopUpSessionId: topUp.id,
          metadata: {
            provider: topUp.provider,
            providerPaymentId: providerTopUp.providerPaymentId,
          },
        },
      );

      await tx.creditTopUpSession.update({
        where: { id: topUp.id },
        data: {
          providerPaymentId: providerTopUp.providerPaymentId,
          providerOrderId:
            providerTopUp.providerOrderId ?? topUp.providerOrderId,
          creditedAmount: providerTopUp.amount,
          feeAmount: providerTopUp.processingFee ?? 0,
          status: CreditTopUpStatus.APPROVED,
          statusDetail: providerTopUp.statusDetail,
          receiptVersion: 1,
          approvedAt: processedAt,
          processedAt,
          receiptIssuedAt: processedAt,
        },
      });

      await tx.transaction.create({
        data: {
          tipo: 'CARGA_SALDO',
          userId: topUp.userId,
          monto: providerTopUp.amount,
          grossAmount: providerTopUp.amount,
          cashChargedAmount: providerTopUp.amount,
          feeProcesamiento: providerTopUp.processingFee ?? 0,
          providerPaymentId: providerTopUp.providerPaymentId,
          providerOrderId: providerTopUp.providerOrderId ?? null,
          estado: 'COMPLETADO',
          metadata: {
            creditTopUpSessionId: topUp.id,
            provider: topUp.provider,
          },
        },
      });
    });

    await this.notifyCreditTopUpApproved({
      userId: topUp.userId,
      topUpSessionId: topUp.id,
      amount: providerTopUp.amount,
      provider: topUp.provider,
      providerPaymentId: providerTopUp.providerPaymentId,
      providerOrderId: providerTopUp.providerOrderId ?? null,
    });
  }

  private async updateTopUpFromProvider(
    providerTopUp: ProviderTopUpDetails,
  ): Promise<void> {
    const topUp = await this.findTopUpForProvider(providerTopUp);
    if (!topUp) {
      return;
    }

    const nextStatus = this.mapProviderStatus(providerTopUp.status);
    const shouldNotifyFailure =
      topUp.status !== nextStatus &&
      (nextStatus === CreditTopUpStatus.REJECTED ||
        nextStatus === CreditTopUpStatus.EXPIRED);

    await this.prisma.creditTopUpSession.update({
      where: { id: topUp.id },
      data: {
        providerPaymentId: providerTopUp.providerPaymentId,
        providerOrderId: providerTopUp.providerOrderId ?? topUp.providerOrderId,
        status: nextStatus,
        statusDetail: providerTopUp.statusDetail,
        processedAt: new Date(),
      },
    });

    if (shouldNotifyFailure) {
      await this.notifyCreditTopUpFailed({
        userId: topUp.userId,
        topUpSessionId: topUp.id,
        amount: providerTopUp.amount,
        provider: topUp.provider,
        status: nextStatus,
        statusDetail: providerTopUp.statusDetail ?? null,
        providerPaymentId: providerTopUp.providerPaymentId,
        providerOrderId: providerTopUp.providerOrderId ?? null,
      });
    }
  }

  private async notifyCreditTopUpApproved(context: {
    userId: string;
    topUpSessionId: string;
    amount: number;
    provider: PaymentsProvider;
    providerPaymentId: string;
    providerOrderId?: string | null;
  }) {
    try {
      await this.activityService.logCreditTopUpApproved(
        context.userId,
        context.topUpSessionId,
        context.amount,
        {
          provider: context.provider,
          providerPaymentId: context.providerPaymentId,
          providerOrderId: context.providerOrderId,
        },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: context.userId },
        select: { email: true },
      });
      if (!user) return;

      await Promise.all([
        this.notificationsService.create(
          context.userId,
          'INFO',
          'Saldo LUK acreditado',
          `Se acreditaron $${context.amount.toFixed(2)} en tu wallet.`,
          '/dashboard/wallet',
        ),
        this.notificationsService.sendCreditTopUpApprovedNotification(
          user.email,
          {
            amount: context.amount,
            topUpSessionId: context.topUpSessionId,
            providerPaymentId: context.providerPaymentId,
            providerOrderId: context.providerOrderId,
          },
        ),
      ]);
    } catch (error) {
      this.captureTopUpSideEffectError(error, 'top-up-approved-notification', {
        topUpSessionId: context.topUpSessionId,
        userId: context.userId,
      });
    }
  }

  private async notifyCreditTopUpFailed(context: {
    userId: string;
    topUpSessionId: string;
    amount: number;
    provider: PaymentsProvider;
    status: CreditTopUpStatus;
    statusDetail?: string | null;
    providerPaymentId?: string | null;
    providerOrderId?: string | null;
  }) {
    try {
      await this.activityService.logCreditTopUpFailed(
        context.userId,
        context.topUpSessionId,
        context.status,
        {
          amount: context.amount,
          provider: context.provider,
          providerPaymentId: context.providerPaymentId,
          providerOrderId: context.providerOrderId,
          statusDetail: context.statusDetail,
        },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: context.userId },
        select: { email: true },
      });
      if (!user) return;

      await Promise.all([
        this.notificationsService.create(
          context.userId,
          'SYSTEM',
          'Carga de saldo no acreditada',
          `La carga de $${context.amount.toFixed(2)} quedó en estado ${context.status}.`,
          '/dashboard/wallet',
        ),
        this.notificationsService.sendCreditTopUpFailedNotification(
          user.email,
          {
            amount: context.amount,
            status: context.status,
            statusDetail: context.statusDetail,
          },
        ),
      ]);
    } catch (error) {
      this.captureTopUpSideEffectError(error, 'top-up-failed-notification', {
        topUpSessionId: context.topUpSessionId,
        userId: context.userId,
        status: context.status,
      });
    }
  }

  private async notifyCreditTopUpRefunded(context: {
    userId: string;
    topUpSessionId: string;
    amount: number;
    fullRefund: boolean;
    provider: PaymentsProvider;
  }) {
    try {
      await this.activityService.logCreditTopUpRefunded(
        context.userId,
        context.topUpSessionId,
        context.amount,
        {
          provider: context.provider,
          refundType: context.fullRefund ? 'full' : 'partial',
        },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: context.userId },
        select: { email: true },
      });
      if (!user) return;

      await Promise.all([
        this.notificationsService.create(
          context.userId,
          'INFO',
          'Reintegro de carga procesado',
          `Se procesó un reintegro de $${context.amount.toFixed(2)} de Saldo LUK.`,
          '/dashboard/wallet',
        ),
        this.notificationsService.sendCreditTopUpRefundedNotification(
          user.email,
          {
            amount: context.amount,
            fullRefund: context.fullRefund,
          },
        ),
      ]);
    } catch (error) {
      this.captureTopUpSideEffectError(error, 'top-up-refund-notification', {
        topUpSessionId: context.topUpSessionId,
        userId: context.userId,
      });
    }
  }

  private captureTopUpSideEffectError(
    error: unknown,
    stage: string,
    extra: Record<string, unknown>,
  ) {
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
        extra,
      },
    );
  }

  private async findTopUpForProvider(providerTopUp: ProviderTopUpDetails) {
    const reference = providerTopUp.externalReference;
    const filters: Prisma.CreditTopUpSessionWhereInput[] = [];
    if (reference) {
      filters.push({ providerReference: reference });
    }
    filters.push({ providerPaymentId: providerTopUp.providerPaymentId });
    if (providerTopUp.providerOrderId) {
      filters.push({ providerOrderId: providerTopUp.providerOrderId });
    }

    return this.prisma.creditTopUpSession.findFirst({
      where: {
        OR: filters,
      },
    });
  }

  private mapProviderStatus(status: string): CreditTopUpStatus {
    switch (status) {
      case 'approved':
        return CreditTopUpStatus.APPROVED;
      case 'rejected':
        return CreditTopUpStatus.REJECTED;
      case 'expired':
        return CreditTopUpStatus.EXPIRED;
      case 'refunded':
        return CreditTopUpStatus.REFUNDED_FULL;
      case 'partially_refunded':
        return CreditTopUpStatus.REFUNDED_PARTIAL;
      case 'pending':
      default:
        return CreditTopUpStatus.PENDING;
    }
  }

  private buildStatusRedirectUrl(
    topUpSessionId: string,
    status: string,
    providerOrderId: string,
    publicToken: string,
  ): string {
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const params = new URLSearchParams({
      payment_id: topUpSessionId,
      status,
      provider_order_id: providerOrderId,
      mock_token: publicToken,
    });
    return `${frontendUrl}/checkout/status?${params.toString()}`;
  }

  private isMockTopUpId(paymentId: string): boolean {
    return paymentId.startsWith('mock_') || paymentId.startsWith('cm');
  }

  private normalizeAmount(amount: number): number {
    const normalized = Math.round(amount * 100) / 100;
    if (!Number.isFinite(normalized) || normalized <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }
    return normalized;
  }
}
