import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayoutsService } from '../payouts/payouts.service';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';
import { EncryptionService } from '../common/services/encryption.service';
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
    shippingAddress: {
      findFirst: jest.fn(),
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
        PLATFORM_FEE_PERCENT: '4',
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
    logPaymentReceived: jest.fn().mockResolvedValue({ id: 'activity-2' }),
    logRaffleCompleted: jest.fn().mockResolvedValue({ id: 'activity-3' }),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
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

  const mockEncryptionService = {
    decryptUserPII: jest.fn((value) => value),
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
    mockPrismaService.shippingAddress.findFirst.mockResolvedValue(null);
    mockPrismaService.user.findUnique.mockResolvedValue(null);
    mockPrismaService.transaction.findFirst.mockResolvedValue(null);
    mockEncryptionService.decryptUserPII.mockImplementation((value) => value);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: EncryptionService, useValue: mockEncryptionService },
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
        purchaseMode: 'CHOOSE_NUMBERS',
        selectedNumbers: [7, 11],
        selectionPremiumPercent: 5,
        selectionPremiumAmount: 50,
      }),
      fee_details: [{ amount: 50 }],
      api_response: { status: 200, headers: [] },
    } as unknown as PaymentResponse;

    const mockPackPaymentData = {
      id: 'pack-123456',
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 2500,
      external_reference: JSON.stringify({
        raffleId: 'raffle-123',
        buyerId: 'buyer-456',
        cantidad: 6,
        baseQuantity: 5,
        bonusQuantity: 1,
        grantedQuantity: 6,
        packApplied: true,
        reservationId: 'res-pack-789',
        grossSubtotal: 3000,
        discountApplied: 500,
        promotionDiscountApplied: 0,
        packDiscountApplied: 500,
        mpChargeAmount: 2500,
        promotionToken: null,
        purchaseMode: 'RANDOM',
        selectedNumbers: null,
        selectionPremiumPercent: 0,
        selectionPremiumAmount: 0,
      }),
      fee_details: [{ amount: 100 }],
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

    it('should create a separate platform subsidy transaction for pack discounts', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 6 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({
        id: 'tx-pack-1',
      });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        totalTickets: 10,
        tickets: [],
      });

      await service.handlePaymentApproved(mockPackPaymentData);

      expect(mockPrismaService.transaction.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          tipo: 'COMPRA_TICKET',
          userId: 'buyer-456',
          raffleId: 'raffle-123',
          monto: 2500,
          grossAmount: 3000,
          promotionDiscountAmount: 0,
          cashChargedAmount: 2500,
          mpPaymentId: 'pack-123456',
          estado: 'COMPLETADO',
          metadata: expect.objectContaining({
            discountApplied: 500,
            packApplied: true,
            baseQuantity: 5,
            bonusQuantity: 1,
            grantedQuantity: 6,
            packDiscountApplied: 500,
            promotionDiscountApplied: 0,
          }),
        }),
      });
      expect(mockPrismaService.transaction.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          tipo: 'SUBSIDIO_PACK_PLATAFORMA',
          userId: 'buyer-456',
          raffleId: 'raffle-123',
          monto: 500,
          grossAmount: 3000,
          promotionDiscountAmount: 500,
          cashChargedAmount: 2500,
          montoNeto: 500,
          estado: 'COMPLETADO',
          metadata: expect.objectContaining({
            packApplied: true,
            baseQuantity: 5,
            bonusQuantity: 1,
            grantedQuantity: 6,
            packDiscountApplied: 500,
            promotionDiscountApplied: 0,
          }),
        }),
      });
    });

    it('should include pack details in buyer and seller notifications', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 6 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({
        id: 'tx-pack-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'buyer@test.com',
        nombre: 'Buyer',
      });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        titulo: 'MacBook Pro',
        sellerId: 'seller-123',
        totalTickets: 20,
        tickets: Array.from({ length: 6 }, (_, index) => ({
          id: `ticket-${index + 1}`,
          estado: 'PAGADO',
        })),
        seller: {
          id: 'seller-123',
          email: 'seller@test.com',
          nombre: 'Seller',
          apellido: 'Pro',
        },
      });
      mockPrismaService.ticket.findMany.mockResolvedValue([
        { id: 'ticket-1', numeroTicket: 4 },
        { id: 'ticket-2', numeroTicket: 7 },
        { id: 'ticket-3', numeroTicket: 12 },
        { id: 'ticket-4', numeroTicket: 19 },
        { id: 'ticket-5', numeroTicket: 23 },
        { id: 'ticket-6', numeroTicket: 31 },
      ]);

      await service.handlePaymentApproved(mockPackPaymentData);

      expect(
        mockNotificationsService.sendTicketPurchaseConfirmation,
      ).toHaveBeenCalledWith(
        'buyer@test.com',
        expect.objectContaining({
          raffleName: 'MacBook Pro',
          amount: 2500,
          packApplied: true,
          baseQuantity: 5,
          bonusQuantity: 1,
          grantedQuantity: 6,
          subsidyAmount: 500,
        }),
      );
      expect(mockNotificationsService.create).toHaveBeenNthCalledWith(
        1,
        'buyer-456',
        'PURCHASE',
        '¡Compra confirmada!',
        expect.stringContaining('recibiste 6 en total'),
        '/dashboard/tickets',
      );
      expect(
        mockNotificationsService.sendSellerTicketPurchasedNotification,
      ).toHaveBeenCalledWith(
        'seller@test.com',
        expect.objectContaining({
          sellerName: 'Seller Pro',
          raffleName: 'MacBook Pro',
          amount: 3000,
          packApplied: true,
          baseQuantity: 5,
          bonusQuantity: 1,
          grantedQuantity: 6,
          subsidyAmount: 500,
        }),
      );
      expect(mockNotificationsService.create).toHaveBeenNthCalledWith(
        2,
        'seller-123',
        'INFO',
        '¡Nueva venta!',
        expect.stringContaining('bonus subsidiados por LUK'),
        '/dashboard/sales',
      );
    });

    it('should not fail approved payments when purchase notifications fail', async () => {
      mockPrismaService.ticket.updateMany.mockResolvedValue({ count: 6 });
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.create.mockResolvedValue({
        id: 'tx-pack-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'buyer@test.com',
        nombre: 'Buyer',
      });
      mockPrismaService.raffle.findUnique.mockResolvedValue({
        id: 'raffle-123',
        titulo: 'MacBook Pro',
        sellerId: 'seller-123',
        totalTickets: 20,
        tickets: [],
        seller: {
          id: 'seller-123',
          email: 'seller@test.com',
          nombre: 'Seller',
          apellido: 'Pro',
        },
      });
      mockPrismaService.ticket.findMany.mockResolvedValue([
        { id: 'ticket-1', numeroTicket: 4 },
      ]);
      mockNotificationsService.sendTicketPurchaseConfirmation.mockRejectedValueOnce(
        new Error('email failed'),
      );

      await expect(
        service.handlePaymentApproved(mockPackPaymentData),
      ).resolves.toBeUndefined();
      expect(mockPrismaService.transaction.create).toHaveBeenCalled();
    });

    it('should persist purchase mode and premium details in transaction metadata', async () => {
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
          metadata: expect.objectContaining({
            purchaseMode: 'CHOOSE_NUMBERS',
            selectedNumbers: [7, 11],
            selectionPremiumPercent: 5,
            selectionPremiumAmount: 50,
          }),
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
      expect(mockActivityService.logRaffleCompleted).toHaveBeenCalledWith(
        'seller-1',
        'raffle-123',
      );
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
            PLATFORM_FEE_PERCENT: '4',
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
          { provide: EncryptionService, useValue: mockEncryptionService },
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
            PLATFORM_FEE_PERCENT: '4',
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
          { provide: EncryptionService, useValue: mockEncryptionService },
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
        baseQuantity: 2,
        bonusQuantity: 0,
        grantedQuantity: 2,
        packApplied: false,
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
            PLATFORM_FEE_PERCENT: '4',
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
          { provide: EncryptionService, useValue: mockEncryptionService },
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
        baseQuantity: 2,
        bonusQuantity: 0,
        grantedQuantity: 2,
        packApplied: false,
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

  describe('createPreference', () => {
    it('builds a Mercado Pago buyer profile with shipping, identification, and purchase history', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'buyer-1',
        email: 'buyer@test.com',
        nombre: 'Buyer',
        apellido: 'User',
        createdAt: new Date('2026-03-01T12:00:00.000Z'),
        googleId: 'google-123',
        documentType: 'DNI',
        documentNumber: 'encrypted-dni',
        phone: 'encrypted-phone',
      });
      mockEncryptionService.decryptUserPII.mockReturnValue({
        id: 'buyer-1',
        email: 'buyer@test.com',
        nombre: 'Buyer',
        apellido: 'User',
        createdAt: new Date('2026-03-01T12:00:00.000Z'),
        googleId: 'google-123',
        documentType: 'DNI',
        documentNumber: '12345678',
        phone: '11 2345-6789',
      });
      mockPrismaService.shippingAddress.findFirst.mockResolvedValue({
        street: 'Av Santa Fe',
        number: '1234',
        postalCode: '1425',
        phone: '+54 11 9999-1111',
      });
      mockPrismaService.transaction.findFirst.mockResolvedValue({
        createdAt: new Date('2026-03-10T15:30:00.000Z'),
      });
      mockMercadoPagoProvider.createCheckoutSession.mockResolvedValue({
        initPoint: 'https://mp.test/checkout',
        preferenceId: 'pref-1',
      });

      await service.createPreference({
        raffleId: 'raffle-1',
        cantidad: 2,
        baseQuantity: 2,
        bonusQuantity: 0,
        grantedQuantity: 2,
        packApplied: false,
        buyerId: 'buyer-1',
        precioPorTicket: 1500,
        tituloRifa: 'Rifa QA',
        reservationId: 'reservation-1',
      });

      expect(
        mockMercadoPagoProvider.createCheckoutSession,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          buyerProfile: {
            email: 'buyer@test.com',
            firstName: 'Buyer',
            lastName: 'User',
            identificationType: 'DNI',
            identificationNumber: '12345678',
            phone: {
              number: '541199991111',
            },
            registrationDate: '2026-03-01T12:00:00.000Z',
            authenticationType: 'Gmail',
            isFirstPurchaseOnline: false,
            lastPurchase: '2026-03-10T15:30:00.000Z',
            address: {
              zipCode: '1425',
              streetName: 'Av Santa Fe',
              streetNumber: '1234',
            },
          },
        }),
      );
    });

    it('uses minimal buyer profile data when optional fields are missing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'buyer-2',
        email: 'buyer2@test.com',
        nombre: 'Buyer',
        apellido: 'No Docs',
        createdAt: new Date('2026-03-02T12:00:00.000Z'),
        googleId: null,
        documentType: null,
        documentNumber: null,
        phone: null,
      });
      mockEncryptionService.decryptUserPII.mockReturnValue({
        id: 'buyer-2',
        email: 'buyer2@test.com',
        nombre: 'Buyer',
        apellido: 'No Docs',
        createdAt: new Date('2026-03-02T12:00:00.000Z'),
        googleId: null,
        documentType: null,
        documentNumber: null,
        phone: null,
      });
      mockPrismaService.shippingAddress.findFirst.mockResolvedValue(null);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockMercadoPagoProvider.createCheckoutSession.mockResolvedValue({
        initPoint: 'https://mp.test/checkout',
        preferenceId: 'pref-2',
      });

      await service.createPreference({
        raffleId: 'raffle-1',
        cantidad: 1,
        baseQuantity: 1,
        bonusQuantity: 0,
        grantedQuantity: 1,
        packApplied: false,
        buyerId: 'buyer-2',
        precioPorTicket: 500,
        tituloRifa: 'Rifa QA',
        reservationId: 'reservation-2',
      });

      expect(
        mockMercadoPagoProvider.createCheckoutSession,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          buyerProfile: {
            email: 'buyer2@test.com',
            firstName: 'Buyer',
            lastName: 'No Docs',
            identificationType: null,
            identificationNumber: null,
            phone: undefined,
            registrationDate: '2026-03-02T12:00:00.000Z',
            authenticationType: 'Web Nativa',
            isFirstPurchaseOnline: true,
            lastPurchase: null,
            address: undefined,
          },
        }),
      );
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

    it('uses PLATFORM_FEE_PERCENT from configuration', async () => {
      const customConfigService = {
        get: jest.fn((key: string) => {
          const config: Record<string, string | boolean> = {
            MP_ACCESS_TOKEN: 'TEST-access-token',
            FRONTEND_URL: 'http://localhost:3000',
            BACKEND_URL: 'http://localhost:3001',
            PAYMENTS_PROVIDER: 'mercadopago',
            PLATFORM_FEE_PERCENT: '7',
          };
          return config[key];
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: customConfigService },
          { provide: NotificationsService, useValue: mockNotificationsService },
          { provide: ActivityService, useValue: mockActivityService },
          { provide: EventEmitter2, useValue: mockEventEmitter },
          { provide: EncryptionService, useValue: mockEncryptionService },
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

      const customFeeService = module.get<PaymentsService>(PaymentsService);
      const result = customFeeService.calculateCommissions(1000);

      expect(result.platformFee).toBeCloseTo(70);
      expect(result.mpFee).toBeCloseTo(50);
      expect(result.netAmount).toBeCloseTo(880);
    });
  });
});
