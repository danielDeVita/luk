import { Test, TestingModule } from '@nestjs/testing';
import {
  CreditTopUpStatus,
  PaymentsProvider,
  Prisma,
  WalletLedgerEntryType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { MercadoPagoTopUpProvider } from './providers/mercado-pago-topup.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const prisma = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
    creditTopUpSession: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    paymentProviderEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    raffle: {
      findUnique: jest.fn(),
    },
  };

  const walletService = {
    ensureWalletAccount: jest.fn(),
    creditUserBalance: jest.fn(),
    debitUserBalance: jest.fn(),
  };

  const mercadoPagoProvider = {
    isConfigured: jest.fn(),
    createCreditTopUp: jest.fn(),
    getTopUp: jest.fn(),
    getTopUpStatus: jest.fn(),
    normalizeWebhook: jest.fn(),
    refundTopUp: jest.fn(),
  };

  const mockPaymentProvider = {
    createCreditTopUp: jest.fn(),
    getTopUpStatus: jest.fn(),
    syncTopUpStatus: jest.fn(),
    getTopUpForCheckout: jest.fn(),
    getTopUp: jest.fn(),
    updateTopUpStatus: jest.fn(),
    recordEvent: jest.fn(),
    getActionType: jest.fn(),
  };

  const notificationsService = {
    create: jest.fn(),
    sendCreditTopUpApprovedNotification: jest.fn(),
    sendCreditTopUpFailedNotification: jest.fn(),
    sendCreditTopUpRefundedNotification: jest.fn(),
  };

  const activityService = {
    logCreditTopUpCreated: jest.fn(),
    logCreditTopUpApproved: jest.fn(),
    logCreditTopUpFailed: jest.fn(),
    logCreditTopUpRefunded: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        PAYMENTS_PROVIDER: 'mock',
        PLATFORM_FEE_PERCENT: '4',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return values[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma),
    );
    prisma.user.findUnique.mockResolvedValue({
      email: 'buyer@luk.test',
      nombre: 'Buyer',
      apellido: 'QA',
    });
    prisma.creditTopUpSession.create.mockResolvedValue({
      id: 'topup-1',
      userId: 'user-1',
    });
    prisma.creditTopUpSession.update.mockResolvedValue({
      id: 'topup-1',
    });
    prisma.paymentProviderEvent.findUnique.mockResolvedValue(null);
    prisma.paymentProviderEvent.create.mockResolvedValue({ id: 'event-1' });
    prisma.transaction.create.mockResolvedValue({ id: 'tx-1' });
    prisma.raffle.findUnique.mockResolvedValue({
      deliveryStatus: 'CONFIRMED',
      paymentReleasedAt: null,
      dispute: null,
    });
    walletService.creditUserBalance.mockResolvedValue({
      creditBalance: new Prisma.Decimal(100),
    });
    walletService.debitUserBalance.mockResolvedValue({
      creditBalance: new Prisma.Decimal(50),
    });
    walletService.ensureWalletAccount.mockResolvedValue({
      creditBalance: new Prisma.Decimal(100),
    });
    mercadoPagoProvider.isConfigured.mockReturnValue(true);
    mockPaymentProvider.createCreditTopUp.mockResolvedValue({
      redirectUrl: 'http://localhost:3000/checkout/mock/topup-1',
      providerSessionId: 'topup-1',
    });
    mockPaymentProvider.getActionType.mockImplementation(
      (action: string) => action,
    );
    notificationsService.create.mockResolvedValue({ id: 'notification-1' });
    notificationsService.sendCreditTopUpApprovedNotification.mockResolvedValue(
      true,
    );
    notificationsService.sendCreditTopUpFailedNotification.mockResolvedValue(
      true,
    );
    notificationsService.sendCreditTopUpRefundedNotification.mockResolvedValue(
      true,
    );
    activityService.logCreditTopUpCreated.mockResolvedValue({
      id: 'activity-created',
    });
    activityService.logCreditTopUpApproved.mockResolvedValue({
      id: 'activity-approved',
    });
    activityService.logCreditTopUpFailed.mockResolvedValue({
      id: 'activity-failed',
    });
    activityService.logCreditTopUpRefunded.mockResolvedValue({
      id: 'activity-refunded',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: walletService },
        { provide: MercadoPagoTopUpProvider, useValue: mercadoPagoProvider },
        { provide: MockPaymentProvider, useValue: mockPaymentProvider },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ActivityService, useValue: activityService },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  it('creates a mock Saldo LUK top-up session', async () => {
    const result = await service.createCreditTopUp('user-1', 250);

    expect(prisma.creditTopUpSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        provider: PaymentsProvider.MOCK,
        amount: 250,
        metadata: { purpose: 'luk_credit_top_up' },
      }),
    });
    expect(mockPaymentProvider.createCreditTopUp).toHaveBeenCalledWith(
      expect.objectContaining({
        topUpSessionId: 'topup-1',
        userId: 'user-1',
        amount: 250,
        buyerProfile: {
          email: 'buyer@luk.test',
          firstName: 'Buyer',
          lastName: 'QA',
        },
      }),
    );
    expect(result).toEqual({
      id: 'topup-1',
      amount: 250,
      redirectUrl: 'http://localhost:3000/checkout/mock/topup-1',
      status: 'initiated',
    });
    expect(activityService.logCreditTopUpCreated).toHaveBeenCalledWith(
      'user-1',
      'topup-1',
      250,
      expect.objectContaining({ provider: PaymentsProvider.MOCK }),
    );
  });

  it('credits Saldo LUK once when a provider top-up is approved', async () => {
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        PAYMENTS_PROVIDER: 'mercado_pago',
        MP_ACCESS_TOKEN: 'TEST-token',
        PLATFORM_FEE_PERCENT: '4',
      };
      return values[key];
    });
    prisma.creditTopUpSession.findFirst.mockResolvedValue({
      id: 'topup-1',
      userId: 'user-1',
      provider: PaymentsProvider.MERCADO_PAGO,
      providerOrderId: 'preference-1',
      processedAt: null,
    });
    mercadoPagoProvider.getTopUp.mockResolvedValue({
      providerPaymentId: 'mp-payment-1',
      status: 'approved',
      statusDetail: 'accredited',
      amount: 500,
      externalReference: 'luk_topup_ref',
      providerOrderId: 'preference-1',
      processingFee: 0,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: walletService },
        { provide: MercadoPagoTopUpProvider, useValue: mercadoPagoProvider },
        { provide: MockPaymentProvider, useValue: mockPaymentProvider },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ActivityService, useValue: activityService },
      ],
    }).compile();
    const mercadoPagoService = module.get(PaymentsService);

    const result = await mercadoPagoService.syncPaymentStatus('mp-payment-1');

    expect(result).toEqual({
      status: 'approved',
      alreadyProcessed: false,
      creditedAmount: 500,
    });
    expect(walletService.creditUserBalance).toHaveBeenCalledWith(
      prisma,
      'user-1',
      500,
      WalletLedgerEntryType.CREDIT_TOP_UP,
      expect.objectContaining({ creditTopUpSessionId: 'topup-1' }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'CARGA_SALDO',
        userId: 'user-1',
        monto: 500,
        providerPaymentId: 'mp-payment-1',
        providerOrderId: 'preference-1',
      }),
    });
    expect(activityService.logCreditTopUpApproved).toHaveBeenCalledWith(
      'user-1',
      'topup-1',
      500,
      expect.objectContaining({
        provider: PaymentsProvider.MERCADO_PAGO,
        providerPaymentId: 'mp-payment-1',
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      'user-1',
      'INFO',
      'Saldo LUK acreditado',
      'Se acreditaron $500.00 en tu wallet.',
      '/dashboard/wallet',
    );
    expect(
      notificationsService.sendCreditTopUpApprovedNotification,
    ).toHaveBeenCalledWith('buyer@luk.test', {
      amount: 500,
      topUpSessionId: 'topup-1',
    });
  });

  it('notifies and logs when a provider top-up fails', async () => {
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        PAYMENTS_PROVIDER: 'mercado_pago',
        MP_ACCESS_TOKEN: 'TEST-token',
        PLATFORM_FEE_PERCENT: '4',
      };
      return values[key];
    });
    prisma.creditTopUpSession.findFirst.mockResolvedValue({
      id: 'topup-1',
      userId: 'user-1',
      provider: PaymentsProvider.MERCADO_PAGO,
      providerOrderId: 'preference-1',
      status: CreditTopUpStatus.PENDING,
    });
    mercadoPagoProvider.getTopUp.mockResolvedValue({
      providerPaymentId: 'mp-payment-1',
      status: 'rejected',
      statusDetail: 'cc_rejected_other_reason',
      amount: 500,
      externalReference: 'luk_topup_ref',
      providerOrderId: 'preference-1',
      processingFee: 0,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: walletService },
        { provide: MercadoPagoTopUpProvider, useValue: mercadoPagoProvider },
        { provide: MockPaymentProvider, useValue: mockPaymentProvider },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ActivityService, useValue: activityService },
      ],
    }).compile();
    const mercadoPagoService = module.get(PaymentsService);

    const result = await mercadoPagoService.syncPaymentStatus('mp-payment-1');

    expect(result).toEqual({
      status: 'rejected',
      alreadyProcessed: false,
      creditedAmount: 0,
    });
    expect(activityService.logCreditTopUpFailed).toHaveBeenCalledWith(
      'user-1',
      'topup-1',
      CreditTopUpStatus.REJECTED,
      expect.objectContaining({
        amount: 500,
        provider: PaymentsProvider.MERCADO_PAGO,
        statusDetail: 'cc_rejected_other_reason',
      }),
    );
    expect(
      notificationsService.sendCreditTopUpFailedNotification,
    ).toHaveBeenCalledWith('buyer@luk.test', {
      amount: 500,
      status: CreditTopUpStatus.REJECTED,
      statusDetail: 'cc_rejected_other_reason',
    });
  });

  it('ignores duplicated provider webhooks before syncing', async () => {
    mercadoPagoProvider.normalizeWebhook.mockReturnValue({
      eventType: 'payment',
      paymentId: 'mp-payment-1',
      providerReference: null,
      providerOrderId: null,
      status: null,
      statusDetail: null,
    });
    prisma.paymentProviderEvent.findUnique.mockResolvedValue({
      id: 'event-1',
    });

    await service.handleProviderWebhook({
      type: 'payment',
      data: { id: 'mp-payment-1' },
    });

    expect(mercadoPagoProvider.getTopUp).not.toHaveBeenCalled();
    expect(prisma.paymentProviderEvent.create).not.toHaveBeenCalled();
  });

  it('does not refund Mercado Pago credit that was already used', async () => {
    prisma.creditTopUpSession.findUnique.mockResolvedValue({
      id: 'topup-1',
      userId: 'user-1',
      provider: PaymentsProvider.MERCADO_PAGO,
      providerPaymentId: 'mp-payment-1',
      status: CreditTopUpStatus.APPROVED,
      creditedAmount: new Prisma.Decimal(100),
      refundedAmount: new Prisma.Decimal(0),
    });
    walletService.ensureWalletAccount.mockResolvedValue({
      creditBalance: new Prisma.Decimal(30),
    });

    const result = await service.refundCreditTopUp('topup-1', 50);

    expect(result).toBe(false);
    expect(mercadoPagoProvider.refundTopUp).not.toHaveBeenCalled();
    expect(walletService.debitUserBalance).not.toHaveBeenCalled();
  });

  it('notifies and logs when unused Saldo LUK is refunded', async () => {
    prisma.creditTopUpSession.findUnique.mockResolvedValue({
      id: 'topup-1',
      userId: 'user-1',
      provider: PaymentsProvider.MOCK,
      providerPaymentId: 'mock-payment-1',
      status: CreditTopUpStatus.APPROVED,
      creditedAmount: new Prisma.Decimal(100),
      refundedAmount: new Prisma.Decimal(0),
    });
    walletService.ensureWalletAccount.mockResolvedValue({
      creditBalance: new Prisma.Decimal(100),
    });

    const result = await service.refundCreditTopUp('topup-1', 40);

    expect(result).toBe(true);
    expect(walletService.debitUserBalance).toHaveBeenCalledWith(
      prisma,
      'user-1',
      40,
      WalletLedgerEntryType.CREDIT_TOP_UP_REFUND,
      expect.objectContaining({ creditTopUpSessionId: 'topup-1' }),
    );
    expect(activityService.logCreditTopUpRefunded).toHaveBeenCalledWith(
      'user-1',
      'topup-1',
      40,
      expect.objectContaining({
        provider: PaymentsProvider.MOCK,
        refundType: 'partial',
      }),
    );
    expect(
      notificationsService.sendCreditTopUpRefundedNotification,
    ).toHaveBeenCalledWith('buyer@luk.test', {
      amount: 40,
      fullRefund: false,
    });
  });

  it('keeps payout release checks provider-neutral', async () => {
    const result = await service.canReleaseFunds('raffle-1');

    expect(result).toEqual({
      canRelease: true,
      reason: 'Fondos listos para liberar',
    });
  });
});
