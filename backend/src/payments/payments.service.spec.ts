import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReferralsService } from '../referrals/referrals.service';
import { PayoutsService } from '../payouts/payouts.service';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import type { PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let _prisma: jest.Mocked<PrismaService>;
  const originalFetch = global.fetch;

  const mockPrismaService = {
    mpEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    mockPayment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    mockPaymentEvent: {
      create: jest.fn(),
    },
    ticket: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    raffle: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | boolean> = {
        MP_ACCESS_TOKEN: 'TEST-access-token',
        FRONTEND_URL: 'http://localhost:3000',
        BACKEND_URL: 'http://localhost:3001',
        PAYMENTS_PROVIDER: 'mercadopago',
      };
      return config[key];
    }),
  };

  const mockNotificationsService = {
    sendTicketPurchaseConfirmation: jest.fn().mockResolvedValue(true),
    sendSellerTicketPurchasedNotification: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
  };

  const mockActivityService = {
    logTicketsPurchased: jest.fn().mockResolvedValue({ id: 'activity-1' }),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockReferralsService = {
    processFirstPurchaseReward: jest.fn().mockResolvedValue(true),
  };

  const mockPayoutsService = {
    createPayout: jest.fn().mockResolvedValue({ id: 'payout-1' }),
  };

  const mockSocialPromotionsService = {
    markRedemptionUsedByReservation: jest.fn().mockResolvedValue(undefined),
    releaseReservedRedemptionByReservation: jest
      .fn()
      .mockResolvedValue(undefined),
    reinstateRedemptionByPaymentId: jest.fn().mockResolvedValue(undefined),
    recordPurchaseAttribution: jest.fn().mockResolvedValue(undefined),
  };

  const mockMercadoPagoProvider = {
    createCheckoutSession: jest.fn(),
    getPaymentStatus: jest.fn(),
    getPayment: jest.fn(),
    refundPayment: jest.fn(),
    releasePayment: jest.fn(),
  };

  const mockMockPaymentProvider = {
    isEnabled: jest.fn().mockReturnValue(true),
    assertEnabled: jest.fn(),
    createCheckoutSession: jest.fn(),
    getPaymentStatus: jest.fn(),
    getPayment: jest.fn(),
    getPaymentForCheckout: jest.fn(),
    syncPaymentStatus: jest.fn(),
    updatePaymentStatus: jest.fn(),
    recordEvent: jest.fn(),
    getActionType: jest.fn((action: string) => action),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockPrismaService.mockPayment.findMany.mockResolvedValue([]);
    mockPrismaService.ticket.deleteMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ReferralsService, useValue: mockReferralsService },
        { provide: PayoutsService, useValue: mockPayoutsService },
        {
          provide: SocialPromotionsService,
          useValue: mockSocialPromotionsService,
        },
        {
          provide: MercadoPagoProvider,
          useValue: mockMercadoPagoProvider,
        },
        {
          provide: MockPaymentProvider,
          useValue: mockMockPaymentProvider,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('handlePaymentApproved', () => {
    const mockPaymentData = {
      id: '12345678',
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 1000,
      external_reference: JSON.stringify({
        raffleId: 'raffle-123',
        buyerId: 'buyer-456',
        cantidad: 2,
        reservationId: 'res-789',
        bonusGrantId: 'grant-123',
        grossSubtotal: 1200,
        discountApplied: 200,
        mpChargeAmount: 1000,
        promotionToken: 'promo-123',
      }),
      fee_details: [{ amount: 50 }],
      api_response: { status: 200, headers: [] },
    } as unknown as PaymentResponse;

    it('should update tickets to PAGADO on first call', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-1' });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [{ estado: 'PAGADO' }, { estado: 'PAGADO' }],
      });

      await service.handlePaymentApproved(mockPaymentData);

      expect(mockPrismaService.ticket.updateMany).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-123',
          buyerId: 'buyer-456',
          estado: 'RESERVADO',
          mpExternalReference: 'res-789',
        },
        data: {
          estado: 'PAGADO',
          mpPaymentId: '12345678',
          mpExternalReference: 'res-789',
        },
      });
    });

    it('should not create duplicate transaction on second call', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.transaction.findFirst.mockResolvedValue({
        id: 'existing-tx',
      });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [{ estado: 'PAGADO' }, { estado: 'PAGADO' }],
      });

      await service.handlePaymentApproved(mockPaymentData);

      expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
    });

    it('should create transaction record with correct fee calculations', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-1' });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [],
      });

      await service.handlePaymentApproved(mockPaymentData);

      expect(mockPrismaService.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tipo: 'COMPRA_TICKET',
          userId: 'buyer-456',
          raffleId: 'raffle-123',
          monto: 1000,
          grossAmount: 1200,
          promotionDiscountAmount: 200,
          cashChargedAmount: 1000,
          mpPaymentId: '12345678',
          estado: 'COMPLETADO',
        }),
      });
    });

    it('should mark the bonus redemption as used and record purchase attribution', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-1' });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [],
      });

      await service.handlePaymentApproved(mockPaymentData);

      expect(
        mockSocialPromotionsService.markRedemptionUsedByReservation,
      ).toHaveBeenCalledWith({
        reservationId: 'res-789',
        bonusGrantId: 'grant-123',
        mpPaymentId: '12345678',
      });
      expect(
        mockSocialPromotionsService.recordPurchaseAttribution,
      ).toHaveBeenCalledWith('buyer-456', 'promo-123', 2, 1200);
    });

    it('should handle missing external_reference gracefully', async () => {
      const paymentWithoutRef = {
        ...mockPaymentData,
        external_reference: null,
      } as unknown as PaymentResponse;

      await service.handlePaymentApproved(paymentWithoutRef);

      expect(mockPrismaService.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in external_reference gracefully', async () => {
      const paymentWithBadRef = {
        ...mockPaymentData,
        external_reference: 'not-valid-json',
      } as unknown as PaymentResponse;

      await service.handlePaymentApproved(paymentWithBadRef);

      expect(mockPrismaService.ticket.updateMany).not.toHaveBeenCalled();
    });

    it('should mark raffle as COMPLETADA when all tickets are sold', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-1' });
      mockPrismaService.raffle.findUnique
        .mockResolvedValueOnce({
          id: 'raffle-123',
          titulo: 'Raffle',
          sellerId: 'seller-1',
          totalTickets: 10,
          seller: {
            id: 'seller-1',
            email: 'seller@test.com',
            nombre: 'Seller',
            apellido: 'User',
          },
          tickets: [],
        })
        .mockResolvedValueOnce({
          id: 'raffle-123',
          estado: 'ACTIVA',
          sellerId: 'seller-1',
          totalTickets: 10,
          tickets: Array(10).fill({ estado: 'PAGADO', precioPagado: 100 }),
        })
        .mockResolvedValueOnce({
          id: 'raffle-123',
          estado: 'SORTEADA',
          tickets: [],
        });
      mockPrismaService.raffle.update.mockResolvedValue({});

      await service.handlePaymentApproved(mockPaymentData);

      expect(mockPrismaService.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-123' },
        data: { estado: 'COMPLETADA' },
      });
    });
  });

  describe('handleMpWebhook', () => {
    beforeEach(() => {
      mockMercadoPagoProvider.getPayment.mockResolvedValue({
        id: '12345678',
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 1000,
        external_reference: JSON.stringify({
          raffleId: 'raffle-123',
          buyerId: 'buyer-456',
          cantidad: 2,
        }),
      });
    });

    it('should ignore non-payment webhook types', async () => {
      await service.handleMpWebhook({
        type: 'merchant_order',
        data: { id: '123' },
      });

      expect(mockPrismaService.mpEvent.findUnique).not.toHaveBeenCalled();
    });

    it('should record MpEvent for idempotency', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue(null);
      mockPrismaService.mpEvent.create.mockResolvedValue({});
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 2 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({});
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [],
      });

      await service.handleMpWebhook({
        type: 'payment',
        data: { id: '12345678' },
      });

      expect(mockPrismaService.mpEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: '12345678',
          eventType: 'payment.approved',
        }),
      });
    });

    it('should skip processing if event already exists (idempotency)', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue({
        id: 'existing',
        eventId: '12345678',
      });

      await service.handleMpWebhook({
        type: 'payment',
        data: { id: '12345678' },
      });

      expect(mockPrismaService.ticket.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.mpEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('syncPaymentStatus', () => {
    beforeEach(() => {
      mockMercadoPagoProvider.getPayment.mockResolvedValue({
        id: '12345678',
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 1000,
        external_reference: JSON.stringify({
          raffleId: 'raffle-123',
          buyerId: 'buyer-456',
          cantidad: 2,
        }),
      });
    });

    it('should return alreadyProcessed=true if event exists', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue({
        id: 'existing',
        eventId: '12345678',
      });

      const result = await service.syncPaymentStatus('12345678');

      expect(result).toEqual({
        status: 'approved',
        alreadyProcessed: true,
        ticketsUpdated: 0,
      });
    });

    it('should process payment and return ticketsUpdated count', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue(null);
      mockPrismaService.mpEvent.create.mockResolvedValue({});
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 3 });
      mockPrismaService.ticket.count.mockResolvedValue(3);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({});
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [],
      });

      const result = await service.syncPaymentStatus('12345678');

      expect(result).toEqual({
        status: 'approved',
        alreadyProcessed: false,
        ticketsUpdated: 3,
      });
    });

    it('should return ticketsUpdated=0 for pending payments', async () => {
      mockMercadoPagoProvider.getPayment.mockResolvedValue({
        id: '12345678',
        status: 'pending',
        external_reference: JSON.stringify({
          raffleId: 'raffle-123',
          buyerId: 'buyer-456',
          cantidad: 2,
          reservationId: 'res-789',
        }),
      });

      mockPrismaService.mpEvent.findUnique.mockResolvedValue(null);

      const result = await service.syncPaymentStatus('12345678');

      expect(result).toEqual({
        status: 'pending',
        alreadyProcessed: false,
        ticketsUpdated: 0,
      });
      expect(
        mockSocialPromotionsService.releaseReservedRedemptionByReservation,
      ).toHaveBeenCalledWith('res-789');
    });
  });

  describe('refundPayment', () => {
    it('passes the refund amount to social promotions for partial refunds', async () => {
      mockMercadoPagoProvider.refundPayment.mockResolvedValue(undefined);

      const result = await service.refundPayment('mp-123', 250.456);

      expect(result).toBe(true);
      expect(
        mockSocialPromotionsService.reinstateRedemptionByPaymentId,
      ).toHaveBeenCalledWith('mp-123', 250.46);
    });

    it('reinstates through social promotions in mock mode too', async () => {
      const mockModeConfigService = {
        get: jest.fn((key: string) => {
          const config: Record<string, string | boolean> = {
            MP_ACCESS_TOKEN: 'mock',
            MP_MOCK_MODE: true,
            FRONTEND_URL: 'http://localhost:3000',
            BACKEND_URL: 'http://localhost:3001',
            PAYMENTS_PROVIDER: 'mock',
          };
          return config[key];
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockModeConfigService },
          { provide: NotificationsService, useValue: mockNotificationsService },
          { provide: ActivityService, useValue: mockActivityService },
          { provide: EventEmitter2, useValue: mockEventEmitter },
          { provide: ReferralsService, useValue: mockReferralsService },
          { provide: PayoutsService, useValue: mockPayoutsService },
          {
            provide: SocialPromotionsService,
            useValue: mockSocialPromotionsService,
          },
          {
            provide: MercadoPagoProvider,
            useValue: mockMercadoPagoProvider,
          },
          {
            provide: MockPaymentProvider,
            useValue: {
              ...mockMockPaymentProvider,
              getPayment: jest.fn().mockResolvedValue({
                id: 'mp-456',
                cashChargedAmount: 900,
              }),
              updatePaymentStatus: jest.fn().mockResolvedValue(undefined),
            },
          },
        ],
      }).compile();

      const mockModeService = module.get<PaymentsService>(PaymentsService);

      const result = await mockModeService.refundPayment('mp-456');

      expect(result).toBe(true);
      expect(
        mockSocialPromotionsService.reinstateRedemptionByPaymentId,
      ).toHaveBeenCalledWith('mp-456', undefined);
    });

    it('returns mock provider status for mock ids', async () => {
      mockMockPaymentProvider.getPaymentStatus.mockResolvedValue({
        status: 'approved',
        statusDetail: 'mock_approved',
        externalReference: '{"raffleId":"123"}',
        merchantOrderId: 'mock_order_1',
      });

      const result = await service.getPaymentStatus('mock_pay_123');

      expect(mockMockPaymentProvider.getPaymentStatus).toHaveBeenCalledWith(
        'mock_pay_123',
      );
      expect(result.status).toBe('approved');
      expect(result.merchantOrderId).toBe('mock_order_1');
    });

    it('creates local checkout sessions in mock mode without MP token', async () => {
      const mockModeConfigService = {
        get: jest.fn((key: string) => {
          const config: Record<string, string | boolean> = {
            FRONTEND_URL: 'http://localhost:3000',
            BACKEND_URL: 'http://localhost:3001',
            PAYMENTS_PROVIDER: 'mock',
          };
          return config[key];
        }),
      };

      const mockCreateCheckoutSession = jest.fn().mockResolvedValue({
        initPoint:
          'http://localhost:3000/checkout/mock/mock_pay_123?token=test',
        preferenceId: 'mock_pay_123',
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockModeConfigService },
          { provide: NotificationsService, useValue: mockNotificationsService },
          { provide: ActivityService, useValue: mockActivityService },
          { provide: EventEmitter2, useValue: mockEventEmitter },
          { provide: ReferralsService, useValue: mockReferralsService },
          { provide: PayoutsService, useValue: mockPayoutsService },
          {
            provide: SocialPromotionsService,
            useValue: mockSocialPromotionsService,
          },
          {
            provide: MercadoPagoProvider,
            useValue: mockMercadoPagoProvider,
          },
          {
            provide: MockPaymentProvider,
            useValue: {
              ...mockMockPaymentProvider,
              createCheckoutSession: mockCreateCheckoutSession,
            },
          },
        ],
      }).compile();

      const mockModeService = module.get<PaymentsService>(PaymentsService);
      const result = await mockModeService.createPreference({
        raffleId: 'raffle-1',
        cantidad: 2,
        buyerId: 'buyer-1',
        precioPorTicket: 500,
        tituloRifa: 'QA raffle',
        reservationId: 'reservation-1',
      });

      expect(mockCreateCheckoutSession).toHaveBeenCalled();
      expect(result.preferenceId).toBe('mock_pay_123');
      expect(result.initPoint).toContain('/checkout/mock/mock_pay_123');
    });

    it('expires previous initiated mock payments for the same buyer and raffle before creating a new one', async () => {
      const mockModeConfigService = {
        get: jest.fn((key: string) => {
          const config: Record<string, string | boolean> = {
            FRONTEND_URL: 'http://localhost:3000',
            BACKEND_URL: 'http://localhost:3001',
            PAYMENTS_PROVIDER: 'mock',
          };
          return config[key];
        }),
      };

      const mockCreateCheckoutSession = jest.fn().mockResolvedValue({
        initPoint:
          'http://localhost:3000/checkout/mock/mock_pay_456?token=test',
        preferenceId: 'mock_pay_456',
      });

      mockPrismaService.mockPayment.findMany.mockResolvedValue([
        {
          id: 'mock_pay_old',
          reservationId: 'reservation-old',
          createdAt: new Date('2026-03-14T22:00:00Z'),
        },
      ]);
      mockPrismaService.ticket.deleteMany.mockResolvedValue({ count: 3 });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockModeConfigService },
          { provide: NotificationsService, useValue: mockNotificationsService },
          { provide: ActivityService, useValue: mockActivityService },
          { provide: EventEmitter2, useValue: mockEventEmitter },
          { provide: ReferralsService, useValue: mockReferralsService },
          { provide: PayoutsService, useValue: mockPayoutsService },
          {
            provide: SocialPromotionsService,
            useValue: mockSocialPromotionsService,
          },
          {
            provide: MercadoPagoProvider,
            useValue: mockMercadoPagoProvider,
          },
          {
            provide: MockPaymentProvider,
            useValue: {
              ...mockMockPaymentProvider,
              createCheckoutSession: mockCreateCheckoutSession,
            },
          },
        ],
      }).compile();

      const mockModeService = module.get<PaymentsService>(PaymentsService);
      await mockModeService.createPreference({
        raffleId: 'raffle-1',
        cantidad: 2,
        buyerId: 'buyer-1',
        precioPorTicket: 500,
        tituloRifa: 'QA raffle',
        reservationId: 'reservation-new',
      });

      expect(mockPrismaService.mockPayment.findMany).toHaveBeenCalledWith({
        where: {
          buyerId: 'buyer-1',
          raffleId: 'raffle-1',
          status: 'INITIATED',
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      expect(mockPrismaService.ticket.deleteMany).toHaveBeenCalledWith({
        where: {
          estado: 'RESERVADO',
          mpExternalReference: 'reservation-old',
        },
      });
      expect(
        mockSocialPromotionsService.releaseReservedRedemptionByReservation,
      ).toHaveBeenCalledWith('reservation-old');
      expect(mockMockPaymentProvider.updatePaymentStatus).toHaveBeenCalledWith(
        'mock_pay_old',
        'EXPIRED',
        'Pago mock expirado por reemplazo de checkout',
        expect.objectContaining({
          processedAt: expect.any(Date),
        }),
      );
      expect(mockMockPaymentProvider.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'mock_pay_old',
          status: 'EXPIRED',
          metadata: expect.objectContaining({
            reservationId: 'reservation-old',
            reason: 'superseded_by_new_checkout',
          }),
        }),
      );
      expect(mockCreateCheckoutSession).toHaveBeenCalled();
    });
  });

  describe('isEventProcessed', () => {
    it('should return true if event exists', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue({ id: 'ev-1' });

      const result = await service.isEventProcessed('12345678');

      expect(result).toBe(true);
    });

    it('should return false if event does not exist', async () => {
      mockPrismaService.mpEvent.findUnique.mockResolvedValue(null);

      const result = await service.isEventProcessed('12345678');

      expect(result).toBe(false);
    });
  });

  describe('calculateCommissions', () => {
    it('should calculate platform fee, mp fee, and net amount correctly', () => {
      const result = service.calculateCommissions(1000);

      expect(result.platformFee).toBeCloseTo(40); // 4% platform fee
      expect(result.mpFee).toBeCloseTo(50); // 5% MP fee
      expect(result.netAmount).toBeCloseTo(910);
      expect(result.totalFees).toBeCloseTo(90);
    });
  });
});
