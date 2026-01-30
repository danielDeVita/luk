import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RaffleTasksService } from './raffle-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutsService } from '../payouts/payouts.service';
import { Prisma } from '@prisma/client';

type MockPrismaService = {
  raffle: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  ticket: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  drawResult: {
    create: jest.Mock;
  };
  priceReduction: {
    create: jest.Mock;
  };
};

type MockPaymentsService = {
  refundPayment: jest.Mock;
};

type MockNotificationsService = {
  create: jest.Mock;
  sendWinnerNotification: jest.Mock;
  sendSellerMustContactWinner: jest.Mock;
  sendRefundNotification: jest.Mock;
  sendPriceReductionSuggestion: jest.Mock;
  sendDeliveryReminderToWinner: jest.Mock;
};

type MockPayoutsService = {
  createPayout: jest.Mock;
  schedulePayoutAfterDelivery: jest.Mock;
};

describe('RaffleTasksService', () => {
  let service: RaffleTasksService;
  let prisma: MockPrismaService;
  let paymentsService: MockPaymentsService;
  let notificationsService: MockNotificationsService;
  let payoutsService: MockPayoutsService;
  let _configService: ConfigService;

  const mockPrismaService = (): MockPrismaService => ({
    raffle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ticket: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    drawResult: {
      create: jest.fn(),
    },
    priceReduction: {
      create: jest.fn(),
    },
  });

  const mockPaymentsService = (): MockPaymentsService => ({
    refundPayment: jest.fn(),
  });

  const mockNotificationsService = (): MockNotificationsService => ({
    create: jest.fn(),
    sendWinnerNotification: jest.fn(),
    sendSellerMustContactWinner: jest.fn(),
    sendRefundNotification: jest.fn(),
    sendPriceReductionSuggestion: jest.fn(),
    sendDeliveryReminderToWinner: jest.fn(),
  });

  const mockPayoutsService = (): MockPayoutsService => ({
    createPayout: jest.fn(),
    schedulePayoutAfterDelivery: jest.fn(),
  });

  let mockConfigServiceGet: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigServiceGet = jest.fn((key: string) => {
      if (key === 'ENABLE_CRON_JOBS') return 'true';
      return null;
    });

    const mockConfigService = {
      get: mockConfigServiceGet,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaffleTasksService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: PaymentsService, useValue: mockPaymentsService() },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService(),
        },
        { provide: PayoutsService, useValue: mockPayoutsService() },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RaffleTasksService>(RaffleTasksService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    paymentsService = module.get(
      PaymentsService,
    ) as unknown as MockPaymentsService;
    notificationsService = module.get(
      NotificationsService,
    ) as unknown as MockNotificationsService;
    payoutsService = module.get(
      PayoutsService,
    ) as unknown as MockPayoutsService;
    _configService = module.get<ConfigService>(ConfigService);
  });

  describe('processExpiredRaffles', () => {
    it('should skip if ENABLE_CRON_JOBS is false', async () => {
      // Recreate service with cron disabled
      const disabledConfigMock = jest.fn((key: string) => {
        if (key === 'ENABLE_CRON_JOBS') return 'false';
        return null;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RaffleTasksService,
          { provide: PrismaService, useValue: mockPrismaService() },
          { provide: PaymentsService, useValue: mockPaymentsService() },
          {
            provide: NotificationsService,
            useValue: mockNotificationsService(),
          },
          { provide: PayoutsService, useValue: mockPayoutsService() },
          { provide: ConfigService, useValue: { get: disabledConfigMock } },
        ],
      }).compile();

      const disabledService =
        module.get<RaffleTasksService>(RaffleTasksService);
      const disabledPrisma = module.get(
        PrismaService,
      ) as unknown as MockPrismaService;

      await disabledService.processExpiredRaffles();

      expect(disabledPrisma.raffle.findMany).not.toHaveBeenCalled();
    });

    it('should find expired ACTIVA raffles past deadline', async () => {
      prisma.raffle.findMany.mockResolvedValue([]);

      await service.processExpiredRaffles();

      expect(prisma.raffle.findMany).toHaveBeenCalledWith({
        where: {
          estado: 'ACTIVA',
          fechaLimiteSorteo: { lt: expect.any(Date) },
          isDeleted: false,
        },
        include: {
          tickets: true,
          seller: true,
        },
      });
    });

    it('should draw raffle when ≥70% tickets sold', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'iPhone 15 Pro',
        sellerId: 'seller-1',
        totalTickets: 100,
        precioPorTicket: new Prisma.Decimal(500),
        tickets: Array.from({ length: 70 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          buyerId: 'buyer-1',
        })),
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.ticket.findMany.mockResolvedValue(mockRaffle.tickets);
      prisma.drawResult.create.mockResolvedValue({ id: 'draw-1' });
      prisma.raffle.update.mockResolvedValue({
        ...mockRaffle,
        winnerId: 'buyer-1',
        winner: { id: 'buyer-1', email: 'buyer@test.com' },
        product: { nombre: 'iPhone 15 Pro 256GB' },
      });
      payoutsService.createPayout.mockResolvedValue({ id: 'payout-1' });

      await service.processExpiredRaffles();

      expect(prisma.drawResult.create).toHaveBeenCalled();
      expect(prisma.raffle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'raffle-1' },
          data: expect.objectContaining({
            estado: 'SORTEADA',
          }),
        }),
      );
    });

    it('should cancel raffle when <70% tickets sold', async () => {
      const mockRaffle = {
        id: 'raffle-2',
        titulo: 'MacBook Pro',
        sellerId: 'seller-2',
        totalTickets: 100,
        precioPorTicket: new Prisma.Decimal(500),
        tickets: Array.from({ length: 50 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          mpPaymentId: `mp-${i}`,
          precioPagado: new Prisma.Decimal(500),
          buyerId: 'buyer-1',
          buyer: { email: `buyer${i}@test.com` },
        })),
        seller: { id: 'seller-2', email: 'seller2@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.priceReduction.create.mockResolvedValue({
        id: 'pr-1',
        raffleId: 'raffle-2',
        precioAnterior: 500,
        precioSugerido: 375,
      });
      paymentsService.refundPayment.mockResolvedValue(true);

      await service.processExpiredRaffles();

      expect(paymentsService.refundPayment).toHaveBeenCalled();
      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-2' },
        data: { estado: 'CANCELADA' },
      });
      expect(prisma.priceReduction.create).toHaveBeenCalled();
    });

    it('should handle exactly 70% threshold (edge case)', async () => {
      const mockRaffle = {
        id: 'raffle-3',
        titulo: 'Test Raffle',
        sellerId: 'seller-3',
        totalTickets: 100,
        precioPorTicket: new Prisma.Decimal(500),
        tickets: Array.from({ length: 70 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          buyerId: 'buyer-1',
        })),
        seller: { id: 'seller-3', email: 'seller3@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.ticket.findMany.mockResolvedValue(mockRaffle.tickets);
      prisma.drawResult.create.mockResolvedValue({ id: 'draw-1' });
      prisma.raffle.update.mockResolvedValue({
        ...mockRaffle,
        winnerId: 'buyer-1',
        winner: { id: 'buyer-1', email: 'buyer@test.com' },
        product: { nombre: 'Test Product' },
      });
      payoutsService.createPayout.mockResolvedValue({ id: 'payout-1' });

      await service.processExpiredRaffles();

      // Should draw, not cancel (70% is exactly at threshold)
      expect(prisma.drawResult.create).toHaveBeenCalled();
      expect(prisma.raffle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estado: 'SORTEADA' }),
        }),
      );
    });
  });

  describe('executeRaffleDraw (via processExpiredRaffles)', () => {
    it('should select random winner from paid tickets', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'Test',
        sellerId: 'seller-1',
        totalTickets: 10,
        tickets: Array.from({ length: 7 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          buyerId: `buyer-${i}`,
        })),
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.ticket.findMany.mockResolvedValue(mockRaffle.tickets);
      prisma.drawResult.create.mockResolvedValue({ id: 'draw-1' });
      prisma.raffle.update.mockResolvedValue({
        ...mockRaffle,
        winnerId: 'buyer-0',
        winner: { id: 'buyer-0', email: 'buyer0@test.com' },
        product: { nombre: 'Test Product' },
      });

      await service.processExpiredRaffles();

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { raffleId: 'raffle-1', estado: 'PAGADO' },
        include: { buyer: true },
      });
    });

    it('should create DrawResult record', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'Test',
        sellerId: 'seller-1',
        totalTickets: 10,
        tickets: Array.from({ length: 7 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          buyerId: `buyer-${i}`,
        })),
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.ticket.findMany.mockResolvedValue(mockRaffle.tickets);
      prisma.drawResult.create.mockResolvedValue({ id: 'draw-1' });
      prisma.raffle.update.mockResolvedValue({
        ...mockRaffle,
        winner: { id: 'buyer-0', email: 'buyer0@test.com' },
        product: { nombre: 'Test Product' },
      });

      await service.processExpiredRaffles();

      expect(prisma.drawResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          raffleId: 'raffle-1',
          method: 'RANDOM_INDEX',
          totalParticipants: 7,
        }),
      });
    });

    it('should update raffle to SORTEADA', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'Test',
        sellerId: 'seller-1',
        totalTickets: 10,
        tickets: Array.from({ length: 7 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          buyerId: `buyer-${i}`,
        })),
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.ticket.findMany.mockResolvedValue(mockRaffle.tickets);
      prisma.drawResult.create.mockResolvedValue({ id: 'draw-1' });
      prisma.raffle.update.mockResolvedValue({
        ...mockRaffle,
        winner: { id: 'buyer-0', email: 'buyer0@test.com' },
        product: { nombre: 'Test Product' },
      });

      await service.processExpiredRaffles();

      expect(prisma.raffle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'raffle-1' },
          data: expect.objectContaining({
            estado: 'SORTEADA',
            fechaSorteoReal: expect.any(Date),
          }),
        }),
      );
    });

    it('should send winner notification', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'iPhone 15 Pro',
        sellerId: 'seller-1',
        totalTickets: 10,
        tickets: Array.from({ length: 7 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          buyerId: `buyer-${i}`,
        })),
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.ticket.findMany.mockResolvedValue(mockRaffle.tickets);
      prisma.drawResult.create.mockResolvedValue({ id: 'draw-1' });
      prisma.raffle.update.mockResolvedValue({
        ...mockRaffle,
        winner: { id: 'buyer-0', email: 'winner@test.com' },
        product: { nombre: 'iPhone 15 Pro 256GB' },
      });

      await service.processExpiredRaffles();

      expect(notificationsService.sendWinnerNotification).toHaveBeenCalledWith(
        'winner@test.com',
        expect.objectContaining({
          raffleName: 'iPhone 15 Pro',
          productName: 'iPhone 15 Pro 256GB',
        }),
      );
    });

    it('should create payout record', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'Test',
        sellerId: 'seller-1',
        totalTickets: 10,
        tickets: Array.from({ length: 7 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          buyerId: `buyer-${i}`,
        })),
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.ticket.findMany.mockResolvedValue(mockRaffle.tickets);
      prisma.drawResult.create.mockResolvedValue({ id: 'draw-1' });
      prisma.raffle.update.mockResolvedValue({
        ...mockRaffle,
        winner: { id: 'buyer-0', email: 'buyer0@test.com' },
        product: { nombre: 'Test Product' },
      });
      payoutsService.createPayout.mockResolvedValue({ id: 'payout-1' });

      await service.processExpiredRaffles();

      expect(payoutsService.createPayout).toHaveBeenCalledWith('raffle-1');
    });
  });

  describe('cancelAndRefundRaffle (via processExpiredRaffles)', () => {
    it('should refund all paid tickets', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'Test',
        sellerId: 'seller-1',
        totalTickets: 100,
        precioPorTicket: new Prisma.Decimal(500),
        tickets: [
          {
            id: 'ticket-1',
            estado: 'PAGADO',
            mpPaymentId: 'mp-1',
            precioPagado: new Prisma.Decimal(500),
            buyerId: 'buyer-1',
            buyer: { email: 'buyer1@test.com' },
          },
          {
            id: 'ticket-2',
            estado: 'PAGADO',
            mpPaymentId: 'mp-2',
            precioPagado: new Prisma.Decimal(500),
            buyerId: 'buyer-2',
            buyer: { email: 'buyer2@test.com' },
          },
        ],
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.priceReduction.create.mockResolvedValue({ id: 'pr-1' });
      paymentsService.refundPayment.mockResolvedValue(true);

      await service.processExpiredRaffles();

      expect(paymentsService.refundPayment).toHaveBeenCalledWith('mp-1');
      expect(paymentsService.refundPayment).toHaveBeenCalledWith('mp-2');
    });

    it('should create PriceReduction record', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'Test',
        sellerId: 'seller-1',
        totalTickets: 100,
        precioPorTicket: new Prisma.Decimal(500),
        tickets: Array.from({ length: 50 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          mpPaymentId: `mp-${i}`,
          precioPagado: new Prisma.Decimal(500),
          buyerId: 'buyer-1',
          buyer: { email: `buyer${i}@test.com` },
        })),
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.priceReduction.create.mockResolvedValue({
        id: 'pr-1',
        raffleId: 'raffle-1',
        precioAnterior: 500,
        precioSugerido: 375,
      });
      paymentsService.refundPayment.mockResolvedValue(true);

      await service.processExpiredRaffles();

      expect(prisma.priceReduction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          raffleId: 'raffle-1',
          precioAnterior: 500,
          // 50% sold = 0.5, percentNotSold = 0.5, reductionFactor = 0.5 * 0.5 = 0.25
          // suggestedPrice = 500 * (1 - 0.25) = 375
          precioSugerido: 375,
        }),
      });
    });

    it('should notify seller with relaunch suggestion', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        titulo: 'iPhone 15 Pro',
        sellerId: 'seller-1',
        totalTickets: 100,
        precioPorTicket: new Prisma.Decimal(500),
        tickets: Array.from({ length: 50 }, (_, i) => ({
          id: `ticket-${i}`,
          estado: 'PAGADO',
          mpPaymentId: `mp-${i}`,
          precioPagado: new Prisma.Decimal(500),
          buyerId: 'buyer-1',
          buyer: { email: `buyer${i}@test.com` },
        })),
        seller: { id: 'seller-1', email: 'seller@test.com' },
      };

      prisma.raffle.findMany.mockResolvedValue([mockRaffle]);
      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.priceReduction.create.mockResolvedValue({
        id: 'pr-1',
        raffleId: 'raffle-1',
      });
      paymentsService.refundPayment.mockResolvedValue(true);

      await service.processExpiredRaffles();

      expect(
        notificationsService.sendPriceReductionSuggestion,
      ).toHaveBeenCalledWith(
        'seller@test.com',
        expect.objectContaining({
          raffleName: 'iPhone 15 Pro',
          currentPrice: 500,
          suggestedPrice: 375,
          raffleId: 'raffle-1',
        }),
      );
    });
  });

  describe('autoReleasePayments (via processRemindersAndReleases)', () => {
    it('should auto-confirm delivery after 7 days without dispute', async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'SORTEADA',
        fechaSorteoReal: sevenDaysAgo,
        deliveryStatus: 'DELIVERED',
        paymentReleasedAt: null,
        seller: { id: 'seller-1' },
        dispute: null, // No dispute
        payout: { id: 'payout-1' },
      };

      // processRemindersAndReleases calls findMany 3 times:
      // 1. sendExpirationReminders - return []
      // 2. autoReleasePayments - return [mockRaffle]
      // 3. sendConfirmationReminders - return []
      prisma.raffle.findMany
        .mockResolvedValueOnce([]) // sendExpirationReminders
        .mockResolvedValueOnce([mockRaffle]) // autoReleasePayments
        .mockResolvedValueOnce([]); // sendConfirmationReminders

      prisma.raffle.update.mockResolvedValue({});
      payoutsService.schedulePayoutAfterDelivery.mockResolvedValue({});

      await service.processRemindersAndReleases();

      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: {
          deliveryStatus: 'CONFIRMED',
          confirmedAt: expect.any(Date),
        },
      });
      expect(payoutsService.schedulePayoutAfterDelivery).toHaveBeenCalledWith(
        'raffle-1',
      );
    });

    it('should not release if dispute exists', async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const mockRaffle = {
        id: 'raffle-1',
        estado: 'SORTEADA',
        fechaSorteoReal: sevenDaysAgo,
        deliveryStatus: 'DELIVERED',
        paymentReleasedAt: null,
        seller: { id: 'seller-1' },
        dispute: { id: 'dispute-1', resolvedAt: null }, // Active dispute
        payout: { id: 'payout-1' },
      };

      // processRemindersAndReleases calls findMany 3 times
      prisma.raffle.findMany
        .mockResolvedValueOnce([]) // sendExpirationReminders
        .mockResolvedValueOnce([mockRaffle]) // autoReleasePayments
        .mockResolvedValueOnce([]); // sendConfirmationReminders

      await service.processRemindersAndReleases();

      // Should not update or schedule payout (dispute is active)
      expect(prisma.raffle.update).not.toHaveBeenCalled();
      expect(payoutsService.schedulePayoutAfterDelivery).not.toHaveBeenCalled();
    });
  });
});
