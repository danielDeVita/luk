import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { Prisma } from '@prisma/client';
import { RaffleEvents } from '../common/events';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';

type MockPrismaService = {
  shippingAddress: { count: jest.Mock };
  ticket: {
    count: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    findUnique: jest.Mock;
  };
  transaction: {
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
};

type MockPaymentsService = {
  createPreference: jest.Mock;
  refundPayment: jest.Mock;
  expireSupersededInitiatedMockPaymentsForRaffle: jest.Mock;
};

type MockEventEmitter = {
  emit: jest.Mock;
};

type MockSocialPromotionsService = {
  reserveBonusForCheckout: jest.Mock;
};

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: MockPrismaService;
  let paymentsService: MockPaymentsService;
  let eventEmitter: MockEventEmitter;
  let socialPromotionsService: MockSocialPromotionsService;

  const mockPrismaService = (): MockPrismaService => ({
    shippingAddress: { count: jest.fn() },
    ticket: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  });

  const mockPaymentsService = (): MockPaymentsService => ({
    createPreference: jest.fn(),
    refundPayment: jest.fn(),
    expireSupersededInitiatedMockPaymentsForRaffle: jest
      .fn()
      .mockResolvedValue(undefined),
  });

  const mockEventEmitter = (): MockEventEmitter => ({
    emit: jest.fn(),
  });

  const mockSocialPromotionsService = (): MockSocialPromotionsService => ({
    reserveBonusForCheckout: jest.fn().mockResolvedValue(null),
  });

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SELECTED_NUMBER_PREMIUM_PERCENT') {
        return 5;
      }

      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: PaymentsService, useValue: mockPaymentsService() },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: SocialPromotionsService,
          useValue: mockSocialPromotionsService(),
        },
        { provide: EventEmitter2, useValue: mockEventEmitter() },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    paymentsService = module.get(
      PaymentsService,
    ) as unknown as MockPaymentsService;
    eventEmitter = module.get(EventEmitter2) as unknown as MockEventEmitter;
    socialPromotionsService = module.get(
      SocialPromotionsService,
    ) as unknown as MockSocialPromotionsService;
  });

  describe('buyTickets - Validation', () => {
    it('should throw if buyer has no shipping address', async () => {
      prisma.shippingAddress.count.mockResolvedValue(0);

      await expect(service.buyTickets('user-1', 'raffle-1', 5)).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.shippingAddress.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should throw if raffle not found', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([]), // Empty array = no raffle
          ticket: { count: jest.fn(), findMany: jest.fn(), create: jest.fn() },
        };
        return callback(mockTx);
      });

      await expect(service.buyTickets('user-1', 'raffle-1', 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if raffle not ACTIVA', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockRaffle = {
          id: 'raffle-1',
          estado: 'SORTEADA',
          seller_id: 'seller-1',
          total_tickets: 100,
          precio_por_ticket: new Prisma.Decimal(500),
          titulo: 'Test Raffle',
          sold_count: BigInt(10),
          is_hidden: false,
        };
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: { count: jest.fn(), findMany: jest.fn(), create: jest.fn() },
        };
        return callback(mockTx);
      });

      await expect(service.buyTickets('user-1', 'raffle-1', 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if user is the seller', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockRaffle = {
          id: 'raffle-1',
          estado: 'ACTIVA',
          seller_id: 'user-1', // Same as buyer
          total_tickets: 100,
          precio_por_ticket: new Prisma.Decimal(500),
          titulo: 'Test Raffle',
          sold_count: BigInt(10),
          is_hidden: false,
        };
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: { count: jest.fn(), findMany: jest.fn(), create: jest.fn() },
        };
        return callback(mockTx);
      });

      await expect(service.buyTickets('user-1', 'raffle-1', 5)).rejects.toThrow(
        'No podés comprar tickets de tu propia rifa',
      );
    });

    it('should enforce 50% max tickets per user', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);
      prisma.$transaction.mockImplementation(async (callback) => {
        const mockRaffle = {
          id: 'raffle-1',
          estado: 'ACTIVA',
          seller_id: 'seller-1',
          total_tickets: 100,
          precio_por_ticket: new Prisma.Decimal(500),
          titulo: 'Test Raffle',
          sold_count: BigInt(10),
          is_hidden: false,
        };
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: {
            count: jest.fn().mockResolvedValue(45), // User already has 45 tickets
            findMany: jest.fn(),
            create: jest.fn(),
          },
        };
        return callback(mockTx);
      });

      // Max allowed = 50, user has 45, tries to buy 10 (would exceed limit)
      await expect(
        service.buyTickets('user-1', 'raffle-1', 10),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('buyTickets - Success', () => {
    it('should create RESERVADO tickets and return checkout URL', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'ACTIVA',
        seller_id: 'seller-1',
        total_tickets: 100,
        precio_por_ticket: new Prisma.Decimal(500),
        titulo: 'iPhone 15 Pro',
        sold_count: BigInt(10),
        is_hidden: false,
      };

      const mockTickets = [
        { id: 'ticket-1', numeroTicket: 11, estado: 'RESERVADO' },
        { id: 'ticket-2', numeroTicket: 12, estado: 'RESERVADO' },
        { id: 'ticket-3', numeroTicket: 13, estado: 'RESERVADO' },
      ];

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: {
            count: jest.fn().mockResolvedValue(0), // No previous tickets
            findMany: jest
              .fn()
              .mockResolvedValue(
                Array.from({ length: 10 }, (_, i) => ({ numeroTicket: i + 1 })),
              ),
            create: jest
              .fn()
              .mockImplementation(async (data) =>
                mockTickets.find(
                  (t) => t.numeroTicket === data.data.numeroTicket,
                ),
              ),
          },
        };
        return callback(mockTx);
      });

      paymentsService.createPreference.mockResolvedValue({
        initPoint: 'https://mp.com/checkout/123',
        preferenceId: 'mp-pref-123',
      });

      const result = await service.buyTickets('user-1', 'raffle-1', 3);

      expect(
        paymentsService.expireSupersededInitiatedMockPaymentsForRaffle,
      ).toHaveBeenCalledWith('user-1', 'raffle-1');
      expect(result.tickets).toHaveLength(3);
      expect(result.initPoint).toBe('https://mp.com/checkout/123');
      expect(result.preferenceId).toBe('mp-pref-123');
      expect(result.totalAmount).toBe(1500); // 500 * 3
      expect(result.cantidadComprada).toBe(3);
    });

    it('should call PaymentsService.createPreference with correct params', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'ACTIVA',
        seller_id: 'seller-1',
        total_tickets: 100,
        precio_por_ticket: new Prisma.Decimal(500),
        titulo: 'iPhone 15 Pro',
        sold_count: BigInt(10),
        is_hidden: false,
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest
              .fn()
              .mockResolvedValue({ id: 'ticket-1', estado: 'RESERVADO' }),
          },
        };
        return callback(mockTx);
      });

      paymentsService.createPreference.mockResolvedValue({
        initPoint: 'https://mp.com/checkout/123',
        preferenceId: 'mp-pref-123',
      });

      await service.buyTickets('user-1', 'raffle-1', 3);

      expect(paymentsService.createPreference).toHaveBeenCalledWith(
        expect.objectContaining({
          raffleId: 'raffle-1',
          cantidad: 3,
          buyerId: 'user-1',
          precioPorTicket: 500,
          tituloRifa: 'iPhone 15 Pro',
          reservationId: expect.any(String),
        }),
      );
    });

    it('should reserve a promotion bonus and send discounted amounts to Mercado Pago', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'ACTIVA',
        seller_id: 'seller-1',
        total_tickets: 100,
        precio_por_ticket: new Prisma.Decimal(500),
        titulo: 'iPhone 15 Pro',
        sold_count: BigInt(10),
        is_hidden: false,
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({
              id: 'ticket-1',
              numeroTicket: 1,
              estado: 'RESERVADO',
            }),
          },
          promotionBonusGrant: {
            findFirst: jest.fn(),
            update: jest.fn(),
          },
          promotionBonusRedemption: {
            create: jest.fn(),
          },
        };
        return callback(mockTx);
      });

      socialPromotionsService.reserveBonusForCheckout.mockResolvedValue({
        grant: { id: 'grant-1' },
        redemption: { id: 'redemption-1' },
        preview: {
          grossSubtotal: 1000,
          discountApplied: 100,
          mpChargeAmount: 900,
        },
      });
      paymentsService.createPreference.mockResolvedValue({
        initPoint: 'https://mp.com/checkout/123',
        preferenceId: 'mp-pref-123',
      });

      const result = await service.buyTickets(
        'user-1',
        'raffle-1',
        2,
        'grant-1',
        'promo-123',
      );

      expect(
        socialPromotionsService.reserveBonusForCheckout,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          buyerId: 'user-1',
          raffleId: 'raffle-1',
          raffleSellerId: 'seller-1',
          grossSubtotal: 1000,
          bonusGrantId: 'grant-1',
        }),
        expect.any(Object),
      );
      expect(paymentsService.createPreference).toHaveBeenCalledWith(
        expect.objectContaining({
          grossSubtotal: 1000,
          discountApplied: 100,
          mpChargeAmount: 900,
          bonusGrantId: 'grant-1',
          promotionBonusRedemptionId: 'redemption-1',
          promotionToken: 'promo-123',
        }),
      );
      expect(result.discountApplied).toBe(100);
      expect(result.mpChargeAmount).toBe(900);
    });

    it('should use serializable transaction with timeout', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'ACTIVA',
        seller_id: 'seller-1',
        total_tickets: 100,
        precio_por_ticket: new Prisma.Decimal(500),
        titulo: 'Test Raffle',
        sold_count: BigInt(10),
        is_hidden: false,
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest
              .fn()
              .mockResolvedValue({ id: 'ticket-1', estado: 'RESERVADO' }),
          },
        };
        return callback(mockTx);
      });

      paymentsService.createPreference.mockResolvedValue({
        initPoint: 'https://mp.com/checkout/123',
        preferenceId: 'mp-pref-123',
      });

      await service.buyTickets('user-1', 'raffle-1', 1);

      // Verify transaction was called with correct options
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        }),
      );
    });

    it('should not reuse ticket numbers that already exist as REEMBOLSADO', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'ACTIVA',
        seller_id: 'seller-1',
        total_tickets: 100,
        precio_por_ticket: new Prisma.Decimal(500),
        titulo: 'Test Raffle',
        sold_count: BigInt(10),
        is_hidden: false,
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest
              .fn()
              .mockResolvedValue([
                { numeroTicket: 1 },
                { numeroTicket: 2 },
                { numeroTicket: 3 },
              ]),
            create: jest.fn().mockImplementation(async (data) => ({
              id: 'ticket-4',
              numeroTicket: data.data.numeroTicket,
              estado: 'RESERVADO',
            })),
          },
        };
        return callback(mockTx);
      });

      paymentsService.createPreference.mockResolvedValue({
        initPoint: 'https://mp.com/checkout/123',
        preferenceId: 'mp-pref-123',
      });

      const result = await service.buyTickets('user-1', 'raffle-1', 1);

      expect(result.tickets[0].numeroTicket).toBe(4);
    });
  });

  describe('buySelectedTickets', () => {
    it('should reserve the requested numbers and add the selected-number premium', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'ACTIVA',
        seller_id: 'seller-1',
        total_tickets: 100,
        precio_por_ticket: new Prisma.Decimal(500),
        titulo: 'iPhone 15 Pro',
        sold_count: BigInt(3),
        is_hidden: false,
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest
              .fn()
              .mockResolvedValue([
                { numeroTicket: 1 },
                { numeroTicket: 2 },
                { numeroTicket: 3 },
              ]),
            create: jest.fn().mockImplementation(async (args) => ({
              id: `ticket-${args.data.numeroTicket}`,
              numeroTicket: args.data.numeroTicket,
              estado: 'RESERVADO',
            })),
          },
        };

        return callback(mockTx);
      });

      paymentsService.createPreference.mockResolvedValue({
        initPoint: 'https://mp.com/checkout/selected',
        preferenceId: 'mp-pref-selected',
      });

      const result = await service.buySelectedTickets(
        'user-1',
        'raffle-1',
        [10, 15],
      );

      expect(result.tickets.map((ticket) => ticket.numeroTicket)).toEqual([
        10, 15,
      ]);
      expect(result.purchaseMode).toBe('CHOOSE_NUMBERS');
      expect(result.selectionPremiumPercent).toBe(5);
      expect(result.selectionPremiumAmount).toBe(50);
      expect(result.grossSubtotal).toBe(1000);
      expect(result.totalAmount).toBe(1050);
      expect(result.mpChargeAmount).toBe(1050);
      expect(paymentsService.createPreference).toHaveBeenCalledWith(
        expect.objectContaining({
          cantidad: 2,
          purchaseMode: 'CHOOSE_NUMBERS',
          selectedNumbers: [10, 15],
          selectionPremiumPercent: 5,
          selectionPremiumAmount: 50,
          grossSubtotal: 1000,
          mpChargeAmount: 1050,
        }),
      );
    });

    it('should reject duplicate selected numbers', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);

      await expect(
        service.buySelectedTickets('user-1', 'raffle-1', [10, 10]),
      ).rejects.toThrow('No podés elegir números repetidos');
    });

    it('should reject selected numbers that are no longer available', async () => {
      prisma.shippingAddress.count.mockResolvedValue(1);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'ACTIVA',
        seller_id: 'seller-1',
        total_tickets: 100,
        precio_por_ticket: new Prisma.Decimal(500),
        titulo: 'iPhone 15 Pro',
        sold_count: BigInt(1),
        is_hidden: false,
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([mockRaffle]),
          ticket: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([{ numeroTicket: 15 }]),
            create: jest.fn(),
          },
        };

        return callback(mockTx);
      });

      await expect(
        service.buySelectedTickets('user-1', 'raffle-1', [10, 15]),
      ).rejects.toThrow('Los siguientes números ya no están disponibles: 15');
    });
  });

  describe('confirmTicketPurchase', () => {
    it('should update RESERVADO tickets to PAGADO by mpPaymentId', async () => {
      prisma.ticket.updateMany.mockResolvedValue({ count: 3 });

      await service.confirmTicketPurchase('mp-payment-123');

      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { mpPaymentId: 'mp-payment-123', estado: 'RESERVADO' },
        data: { estado: 'PAGADO' },
      });
    });
  });

  describe('refundTickets', () => {
    it('should refund all PAGADO tickets via PaymentsService', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          buyerId: 'buyer-1',
          mpPaymentId: 'mp-1',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
        {
          id: 'ticket-2',
          buyerId: 'buyer-1',
          mpPaymentId: 'mp-2',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
        {
          id: 'ticket-3',
          buyerId: 'buyer-2',
          mpPaymentId: 'mp-3',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
      ];

      prisma.ticket.findMany.mockResolvedValue(mockTickets);
      prisma.ticket.updateMany.mockResolvedValue({ count: 3 });
      paymentsService.refundPayment.mockResolvedValue(true);

      await service.refundTickets('raffle-1');

      expect(paymentsService.refundPayment).toHaveBeenCalledTimes(3);
      expect(paymentsService.refundPayment).toHaveBeenCalledWith('mp-1');
      expect(paymentsService.refundPayment).toHaveBeenCalledWith('mp-2');
      expect(paymentsService.refundPayment).toHaveBeenCalledWith('mp-3');
    });

    it('should update ticket status to REEMBOLSADO', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          buyerId: 'buyer-1',
          mpPaymentId: 'mp-1',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
      ];

      prisma.ticket.findMany.mockResolvedValue(mockTickets);
      prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
      paymentsService.refundPayment.mockResolvedValue(true);

      await service.refundTickets('raffle-1');

      expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ticket-1'] }, estado: 'PAGADO' },
        data: { estado: 'REEMBOLSADO' },
      });
    });

    it('should emit TICKETS_REFUNDED event per buyer', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          buyerId: 'buyer-1',
          mpPaymentId: 'mp-1',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
        {
          id: 'ticket-2',
          buyerId: 'buyer-1',
          mpPaymentId: 'mp-2',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
        {
          id: 'ticket-3',
          buyerId: 'buyer-2',
          mpPaymentId: 'mp-3',
          precioPagado: new Prisma.Decimal(1000),
          estado: 'PAGADO',
        },
      ];

      prisma.ticket.findMany.mockResolvedValue(mockTickets);
      prisma.ticket.updateMany.mockResolvedValue({ count: 3 });
      paymentsService.refundPayment.mockResolvedValue(true);

      await service.refundTickets('raffle-1');

      // Should emit 2 events (one per buyer)
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        RaffleEvents.TICKETS_REFUNDED,
        expect.objectContaining({
          raffleId: 'raffle-1',
          buyerId: 'buyer-1',
          ticketCount: 2,
          refundAmount: 1000,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        RaffleEvents.TICKETS_REFUNDED,
        expect.objectContaining({
          raffleId: 'raffle-1',
          buyerId: 'buyer-2',
          ticketCount: 1,
          refundAmount: 1000,
        }),
      );
    });

    it('should refund each payment only once and emit the full charged amount', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          buyerId: 'buyer-1',
          mpPaymentId: 'mp-1',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
        {
          id: 'ticket-2',
          buyerId: 'buyer-1',
          mpPaymentId: 'mp-1',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
        {
          id: 'ticket-3',
          buyerId: 'buyer-2',
          mpPaymentId: 'mp-2',
          precioPagado: new Prisma.Decimal(500),
          estado: 'PAGADO',
        },
      ];

      prisma.ticket.findMany.mockResolvedValue(mockTickets);
      prisma.transaction.findMany.mockResolvedValue([
        { mpPaymentId: 'mp-1', cashChargedAmount: new Prisma.Decimal(1050) },
        { mpPaymentId: 'mp-2', cashChargedAmount: new Prisma.Decimal(500) },
      ]);
      prisma.ticket.updateMany.mockResolvedValue({ count: 3 });
      paymentsService.refundPayment.mockResolvedValue(true);

      await service.refundTickets('raffle-1');

      expect(paymentsService.refundPayment).toHaveBeenCalledTimes(2);
      expect(paymentsService.refundPayment).toHaveBeenCalledWith('mp-1');
      expect(paymentsService.refundPayment).toHaveBeenCalledWith('mp-2');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        RaffleEvents.TICKETS_REFUNDED,
        expect.objectContaining({
          raffleId: 'raffle-1',
          buyerId: 'buyer-1',
          ticketCount: 2,
          refundAmount: 1050,
        }),
      );
    });
  });

  describe('getAvailableTicketNumbers', () => {
    it('should exclude ticket numbers that already exist as REEMBOLSADO', async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { numeroTicket: 1 },
        { numeroTicket: 2 },
        { numeroTicket: 3 },
      ]);

      const availableNumbers = await service.getAvailableTicketNumbers(
        'raffle-1',
        5,
      );

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { raffleId: 'raffle-1' },
        select: { numeroTicket: true },
      });
      expect(availableNumbers).toEqual([4, 5]);
    });
  });
});
