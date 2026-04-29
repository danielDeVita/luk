import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreditTopUpEventType,
  CreditTopUpStatus,
  PaymentsProvider,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateCreditTopUpInput,
  CreateCreditTopUpResult,
  MockTopUpAction,
  MockTopUpSummary,
  SyncTopUpStatusResult,
  TopUpStatusResult,
} from './payment-provider.types';

@Injectable()
export class MockPaymentProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  isEnabled(): boolean {
    const provider = (
      this.configService.get<string>('PAYMENTS_PROVIDER') || ''
    ).trim();
    return provider.toLowerCase() === 'mock';
  }

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

  async createCreditTopUp(
    data: CreateCreditTopUpInput,
  ): Promise<CreateCreditTopUpResult> {
    this.assertEnabled();

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const publicToken = randomUUID().replace(/-/g, '');
    const providerOrderId = `mock_order_${Date.now()}`;

    await this.prisma.creditTopUpSession.update({
      where: { id: data.topUpSessionId },
      data: {
        provider: PaymentsProvider.MOCK,
        publicToken,
        providerOrderId,
        status: CreditTopUpStatus.INITIATED,
        statusDetail: 'Carga mock iniciada',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    return {
      redirectUrl: `${frontendUrl}/checkout/mock/${data.topUpSessionId}?token=${publicToken}`,
      providerSessionId: data.topUpSessionId,
    };
  }

  async getTopUpStatus(topUpSessionId: string): Promise<TopUpStatusResult> {
    const topUp = await this.getTopUp(topUpSessionId);
    return {
      status: this.mapStatus(topUp.status),
      statusDetail: topUp.statusDetail || '',
      externalReference: topUp.providerReference,
      providerOrderId: topUp.providerOrderId,
    };
  }

  async syncTopUpStatus(
    topUpSessionId: string,
  ): Promise<SyncTopUpStatusResult> {
    const topUp = await this.getTopUp(topUpSessionId);
    return {
      status: this.mapStatus(topUp.status),
      alreadyProcessed: Boolean(topUp.processedAt),
      creditedAmount: Number(topUp.creditedAmount),
    };
  }

  async getTopUp(topUpSessionId: string) {
    const topUp = await this.prisma.creditTopUpSession.findUnique({
      where: { id: topUpSessionId },
    });

    if (!topUp) {
      throw new NotFoundException('Carga mock no encontrada');
    }

    return topUp;
  }

  async getTopUpForCheckout(
    topUpSessionId: string,
    publicToken: string,
  ): Promise<MockTopUpSummary> {
    this.assertEnabled();

    const topUp = await this.prisma.creditTopUpSession.findFirst({
      where: {
        id: topUpSessionId,
        publicToken,
      },
      include: {
        user: { select: { email: true } },
      },
    });

    if (!topUp) {
      throw new NotFoundException('Carga mock no encontrada');
    }

    return {
      id: topUp.id,
      publicToken: topUp.publicToken || publicToken,
      userId: topUp.userId,
      userEmail: topUp.user.email,
      amount: Number(topUp.amount),
      creditedAmount: Number(topUp.creditedAmount),
      refundedAmount: Number(topUp.refundedAmount),
      status: this.mapStatus(topUp.status),
      statusDetail: topUp.statusDetail || '',
      providerOrderId: topUp.providerOrderId || topUp.id,
      createdAt: topUp.createdAt.toISOString(),
      approvedAt: topUp.approvedAt?.toISOString() ?? null,
      refundedAt: topUp.refundedAt?.toISOString() ?? null,
    };
  }

  async updateTopUpStatus(
    topUpSessionId: string,
    status: CreditTopUpStatus,
    statusDetail: string,
    data?: Prisma.CreditTopUpSessionUpdateInput,
  ) {
    return this.prisma.creditTopUpSession.update({
      where: { id: topUpSessionId },
      data: {
        status,
        statusDetail,
        ...data,
      },
    });
  }

  async recordEvent(input: {
    topUpSessionId: string;
    eventType: CreditTopUpEventType;
    status: CreditTopUpStatus;
    amount?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    await this.prisma.creditTopUpEvent.create({
      data: {
        creditTopUpSessionId: input.topUpSessionId,
        eventType: input.eventType,
        status: input.status,
        amount: input.amount,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  getActionType(action: MockTopUpAction): CreditTopUpEventType {
    switch (action) {
      case 'APPROVE':
        return CreditTopUpEventType.APPROVE;
      case 'PEND':
        return CreditTopUpEventType.PEND;
      case 'REJECT':
        return CreditTopUpEventType.REJECT;
      case 'REFUND_FULL':
        return CreditTopUpEventType.REFUND_FULL;
      case 'REFUND_PARTIAL':
        return CreditTopUpEventType.REFUND_PARTIAL;
      case 'EXPIRE':
      default:
        return CreditTopUpEventType.EXPIRE;
    }
  }

  private mapStatus(status: CreditTopUpStatus): string {
    switch (status) {
      case CreditTopUpStatus.APPROVED:
        return 'approved';
      case CreditTopUpStatus.PENDING:
        return 'pending';
      case CreditTopUpStatus.REJECTED:
        return 'rejected';
      case CreditTopUpStatus.EXPIRED:
        return 'expired';
      case CreditTopUpStatus.REFUNDED_FULL:
        return 'refunded';
      case CreditTopUpStatus.REFUNDED_PARTIAL:
        return 'partially_refunded';
      case CreditTopUpStatus.INITIATED:
      default:
        return 'initiated';
    }
  }
}
