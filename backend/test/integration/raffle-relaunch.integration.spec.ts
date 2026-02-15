import {
  TestContext,
  createTestApp,
  cleanupTestApp,
} from '../integration/setup';
import {
  createTestUser,
  createTestSeller,
  createTestRaffle,
  createTestTickets,
} from '../integration/factories';
import { RafflesService } from '../../src/raffles/raffles.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { RaffleStatus, TicketStatus } from '@prisma/client';

/**
 * Integration tests for raffle relaunch flow.
 * Tests the automatic price reduction and relaunch of cancelled raffles.
 */
describe('Raffle Relaunch Flow (Integration)', () => {
  let ctx: TestContext;
  let rafflesService: RafflesService;
  let notificationsService: NotificationsService;

  const mockSendNotification = jest.fn();

  beforeAll(async () => {
    ctx = await createTestApp();
    rafflesService = ctx.app.get<RafflesService>(RafflesService);
    notificationsService =
      ctx.app.get<NotificationsService>(NotificationsService);

    jest
      .spyOn(notificationsService, 'sendRelaunchSuggestion')
      .mockImplementation(mockSendNotification);
    jest
      .spyOn(notificationsService, 'sendRaffleCreated')
      .mockImplementation(mockSendNotification);
  });

  afterAll(async () => {
    await cleanupTestApp(ctx);
  });

  beforeEach(async () => {
    mockSendNotification.mockClear();
  });

  describe('Automatic price reduction calculation', () => {
    it('should calculate 20% price reduction for < 50% sales', async () => {
      const seller = await createTestSeller(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      // Sell only 30 tickets (30%)
      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, raffle.id, buyer.id, 30, {
        estado: TicketStatus.PAGADO,
      });

      // Cancel raffle
      await rafflesService.cancelRaffle(raffle.id, seller.id);

      // Check price reduction suggestion
      const suggestion = await rafflesService.calculateRelaunchPrice(raffle.id);

      expect(suggestion.originalPrice).toBe(100);
      expect(suggestion.suggestedPrice).toBe(80); // 20% reduction
      expect(suggestion.reductionPercentage).toBe(20);
    });

    it('should calculate 10% price reduction for 50-69% sales', async () => {
      const seller = await createTestSeller(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      // Sell 60 tickets (60%)
      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, raffle.id, buyer.id, 60, {
        estado: TicketStatus.PAGADO,
      });

      await rafflesService.cancelRaffle(raffle.id, seller.id);

      const suggestion = await rafflesService.calculateRelaunchPrice(raffle.id);

      expect(suggestion.suggestedPrice).toBe(90); // 10% reduction
      expect(suggestion.reductionPercentage).toBe(10);
    });

    it('should NOT suggest relaunch for >= 70% sales', async () => {
      const seller = await createTestSeller(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      // Sell 75 tickets (75%)
      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, raffle.id, buyer.id, 75, {
        estado: TicketStatus.PAGADO,
      });

      // Raffle should complete, not cancel
      const completedRaffle = await rafflesService.completeRaffle(raffle.id);
      expect(completedRaffle.estado).toBe(RaffleStatus.COMPLETADA);

      // No relaunch suggestion
      await expect(
        rafflesService.calculateRelaunchPrice(raffle.id),
      ).rejects.toThrow('Raffle not eligible for relaunch');
    });
  });

  describe('Seller relaunches with suggested price', () => {
    it('should create new raffle with reduced price', async () => {
      const seller = await createTestSeller(ctx.prisma);

      const originalRaffle = await createTestRaffle(ctx.prisma, seller.id, {
        titulo: 'Original Raffle',
        descripcion: 'Original description that is long enough',
        totalTickets: 100,
        precioPorTicket: 100,
      });

      // Add some sales
      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, originalRaffle.id, buyer.id, 40, {
        estado: TicketStatus.PAGADO,
      });

      // Cancel original
      await rafflesService.cancelRaffle(originalRaffle.id, seller.id);

      // Get suggestion
      const suggestion = await rafflesService.calculateRelaunchPrice(
        originalRaffle.id,
      );

      // Relaunch with suggested price
      const newRaffle = await rafflesService.relaunchRaffle(
        {
          originalRaffleId: originalRaffle.id,
          newPrice: suggestion.suggestedPrice,
        },
        seller.id,
      );

      // Verify new raffle
      expect(newRaffle.id).not.toBe(originalRaffle.id);
      expect(newRaffle.titulo).toBe('Original Raffle');
      expect(Number(newRaffle.precioPorTicket)).toBe(80);
      expect(newRaffle.estado).toBe(RaffleStatus.ACTIVA);
      expect(newRaffle.relaunchedFromId).toBe(originalRaffle.id);

      // Verify original marked as relaunched
      const updatedOriginal = await ctx.prisma.raffle.findUnique({
        where: { id: originalRaffle.id },
      });
      expect(updatedOriginal?.relaunchedToId).toBe(newRaffle.id);
    });
  });

  describe('Seller customizes price before relaunch', () => {
    it('should allow custom price between min and suggested', async () => {
      const seller = await createTestSeller(ctx.prisma);

      const originalRaffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, originalRaffle.id, buyer.id, 30, {
        estado: TicketStatus.PAGADO,
      });

      await rafflesService.cancelRaffle(originalRaffle.id, seller.id);

      // Relaunch with custom price (lower than suggested)
      const newRaffle = await rafflesService.relaunchRaffle(
        {
          originalRaffleId: originalRaffle.id,
          newPrice: 70, // Custom price, lower than suggested 80
        },
        seller.id,
      );

      expect(Number(newRaffle.precioPorTicket)).toBe(70);
    });

    it('should reject price higher than original', async () => {
      const seller = await createTestSeller(ctx.prisma);

      const originalRaffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, originalRaffle.id, buyer.id, 30, {
        estado: TicketStatus.PAGADO,
      });

      await rafflesService.cancelRaffle(originalRaffle.id, seller.id);

      // Try to relaunch with higher price
      await expect(
        rafflesService.relaunchRaffle(
          {
            originalRaffleId: originalRaffle.id,
            newPrice: 120, // Higher than original
          },
          seller.id,
        ),
      ).rejects.toThrow('New price cannot exceed original price');
    });
  });

  describe('Relaunch notification and tracking', () => {
    it('should notify seller of relaunch opportunity', async () => {
      const seller = await createTestSeller(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, raffle.id, buyer.id, 30, {
        estado: TicketStatus.PAGADO,
      });

      await rafflesService.cancelRaffle(raffle.id, seller.id);

      // Generate relaunch suggestion
      await rafflesService.calculateRelaunchPrice(raffle.id);

      // Verify notification sent to seller
      expect(mockSendNotification).toHaveBeenCalled();
      const notificationCall = mockSendNotification.mock.calls[0];
      expect(notificationCall[0]).toBe(seller.email);
      expect(notificationCall[1]).toContain('relaunch');
    });

    it('should track relaunch history', async () => {
      const seller = await createTestSeller(ctx.prisma);

      // Create first raffle
      const raffle1 = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, raffle1.id, buyer.id, 30, {
        estado: TicketStatus.PAGADO,
      });

      await rafflesService.cancelRaffle(raffle1.id, seller.id);

      // Relaunch once
      const raffle2 = await rafflesService.relaunchRaffle(
        {
          originalRaffleId: raffle1.id,
          newPrice: 80,
        },
        seller.id,
      );

      // Cancel and relaunch again
      await createTestTickets(ctx.prisma, raffle2.id, buyer.id, 20, {
        estado: TicketStatus.PAGADO,
      });
      await rafflesService.cancelRaffle(raffle2.id, seller.id);

      const raffle3 = await rafflesService.relaunchRaffle(
        {
          originalRaffleId: raffle2.id,
          newPrice: 60,
        },
        seller.id,
      );

      // Verify chain of relaunches
      expect(raffle3.relaunchedFromId).toBe(raffle2.id);
      expect(raffle2.relaunchedFromId).toBe(raffle1.id);
      expect(raffle1.relaunchedToId).toBe(raffle2.id);
      expect(raffle2.relaunchedToId).toBe(raffle3.id);
    });
  });

  describe('Relaunch constraints', () => {
    it('should only allow relaunch by original seller', async () => {
      const seller = await createTestSeller(ctx.prisma);
      const otherSeller = await createTestSeller(ctx.prisma);

      const raffle = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, raffle.id, buyer.id, 30, {
        estado: TicketStatus.PAGADO,
      });

      await rafflesService.cancelRaffle(raffle.id, seller.id);

      // Try to relaunch by different seller
      await expect(
        rafflesService.relaunchRaffle(
          {
            originalRaffleId: raffle.id,
            newPrice: 80,
          },
          otherSeller.id,
        ),
      ).rejects.toThrow('Only original seller can relaunch');
    });

    it('should prevent relaunch of already relaunched raffle', async () => {
      const seller = await createTestSeller(ctx.prisma);

      const raffle1 = await createTestRaffle(ctx.prisma, seller.id, {
        totalTickets: 100,
        precioPorTicket: 100,
      });

      const buyer = await createTestUser(ctx.prisma);
      await createTestTickets(ctx.prisma, raffle1.id, buyer.id, 30, {
        estado: TicketStatus.PAGADO,
      });

      await rafflesService.cancelRaffle(raffle1.id, seller.id);

      // First relaunch
      const _raffle2 = await rafflesService.relaunchRaffle(
        {
          originalRaffleId: raffle1.id,
          newPrice: 80,
        },
        seller.id,
      );

      // Try to relaunch original again
      await expect(
        rafflesService.relaunchRaffle(
          {
            originalRaffleId: raffle1.id,
            newPrice: 70,
          },
          seller.id,
        ),
      ).rejects.toThrow('Raffle already relaunched');
    });
  });
});
