import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { RaffleTasksService } from './raffle-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutsService } from '../payouts/payouts.service';
import { TicketsService } from '../tickets/tickets.service';

type MockPrismaService = {
  raffle: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  ticket: {
    updateMany: jest.Mock;
  };
  priceReduction: {
    create: jest.Mock;
  };
  notification: {
    findFirst: jest.Mock;
  };
};

type MockTicketsService = {
  refundTickets: jest.Mock;
  drawRaffleIfEligible: jest.Mock;
};

type MockNotificationsService = {
  create: jest.Mock;
  sendRefundNotification: jest.Mock;
  sendPriceReductionSuggestion: jest.Mock;
  sendDeliveryReminderToWinner: jest.Mock;
  sendRaffleExpirationReminder: jest.Mock;
};

type MockPayoutsService = {
  processDuePayouts: jest.Mock;
  processPayoutForRaffle: jest.Mock;
};

describe('RaffleTasksService', () => {
  let service: RaffleTasksService;
  let prisma: MockPrismaService;
  let ticketsService: MockTicketsService;
  let notificationsService: MockNotificationsService;
  let payoutsService: MockPayoutsService;

  const mockPrismaService = (): MockPrismaService => ({
    raffle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ticket: {
      updateMany: jest.fn(),
    },
    priceReduction: {
      create: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
    },
  });

  const mockTicketsService = (): MockTicketsService => ({
    refundTickets: jest.fn(),
    drawRaffleIfEligible: jest.fn(),
  });

  const mockNotificationsService = (): MockNotificationsService => ({
    create: jest.fn(),
    sendRefundNotification: jest.fn(),
    sendPriceReductionSuggestion: jest.fn(),
    sendDeliveryReminderToWinner: jest.fn(),
    sendRaffleExpirationReminder: jest.fn(),
  });

  const mockPayoutsService = (): MockPayoutsService => ({
    processDuePayouts: jest.fn(),
    processPayoutForRaffle: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaffleTasksService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: TicketsService, useValue: mockTicketsService() },
        { provide: NotificationsService, useValue: mockNotificationsService() },
        { provide: PayoutsService, useValue: mockPayoutsService() },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'ENABLE_CRON_JOBS' ? 'true' : null,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<RaffleTasksService>(RaffleTasksService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    ticketsService = module.get(
      TicketsService,
    ) as unknown as MockTicketsService;
    notificationsService = module.get(
      NotificationsService,
    ) as unknown as MockNotificationsService;
    payoutsService = module.get(
      PayoutsService,
    ) as unknown as MockPayoutsService;

    prisma.notification.findFirst.mockResolvedValue(null);
    notificationsService.create.mockResolvedValue({ id: 'notification-1' });
    notificationsService.sendRaffleExpirationReminder.mockResolvedValue(true);
  });

  describe('processExpiredRaffles', () => {
    it('should skip if ENABLE_CRON_JOBS is false', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RaffleTasksService,
          { provide: PrismaService, useValue: mockPrismaService() },
          { provide: TicketsService, useValue: mockTicketsService() },
          {
            provide: NotificationsService,
            useValue: mockNotificationsService(),
          },
          { provide: PayoutsService, useValue: mockPayoutsService() },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) =>
                key === 'ENABLE_CRON_JOBS' ? 'false' : null,
              ),
            },
          },
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

    it('should query expired ACTIVA and recovery COMPLETADA raffles', async () => {
      prisma.raffle.findMany.mockResolvedValue([]);

      await service.processExpiredRaffles();

      expect(prisma.raffle.findMany).toHaveBeenCalledWith({
        where: {
          isDeleted: false,
          OR: [
            { estado: 'ACTIVA', fechaLimiteSorteo: { lt: expect.any(Date) } },
            { estado: 'COMPLETADA' },
          ],
        },
        include: {
          tickets: true,
          seller: true,
        },
      });
    });

    it('should execute draw for COMPLETADA raffles', async () => {
      prisma.raffle.findMany.mockResolvedValue([
        {
          id: 'raffle-1',
          estado: 'COMPLETADA',
          tickets: [],
          seller: { id: 'seller-1', email: 'seller@test.com' },
        },
      ]);
      ticketsService.drawRaffleIfEligible.mockResolvedValue(true);

      await service.processExpiredRaffles();

      expect(ticketsService.drawRaffleIfEligible).toHaveBeenCalledWith(
        'raffle-1',
      );
    });

    it('should draw ACTIVA raffle when at least 70% sold', async () => {
      prisma.raffle.findMany.mockResolvedValue([
        {
          id: 'raffle-1',
          estado: 'ACTIVA',
          totalTickets: 10,
          tickets: Array.from({ length: 7 }, (_, i) => ({
            id: `t-${i}`,
            estado: 'PAGADO',
          })),
          seller: { id: 'seller-1', email: 'seller@test.com' },
        },
      ]);
      ticketsService.drawRaffleIfEligible.mockResolvedValue(true);

      await service.processExpiredRaffles();

      expect(ticketsService.drawRaffleIfEligible).toHaveBeenCalledWith(
        'raffle-1',
      );
    });

    it('should cancel and mark refunded when all refunds succeed', async () => {
      prisma.raffle.findMany.mockResolvedValue([
        {
          id: 'raffle-1',
          estado: 'ACTIVA',
          totalTickets: 10,
          tickets: Array.from({ length: 5 }, (_, i) => ({
            id: `p-${i}`,
            estado: 'PAGADO',
          })),
          seller: { id: 'seller-1', email: 'seller@test.com' },
        },
      ]);

      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        titulo: 'Test Raffle',
        precioPorTicket: new Prisma.Decimal(500),
        tickets: [
          {
            id: 'ticket-1',
            precioPagado: new Prisma.Decimal(500),
            buyer: { email: 'buyer1@test.com' },
          },
          {
            id: 'ticket-2',
            precioPagado: new Prisma.Decimal(500),
            buyer: { email: 'buyer2@test.com' },
          },
        ],
        seller: { id: 'seller-1', email: 'seller@test.com' },
      });
      ticketsService.refundTickets.mockResolvedValue({ count: 2 });
      prisma.raffle.update.mockResolvedValue({});
      prisma.priceReduction.create.mockResolvedValue({ id: 'pr-1' });

      await service.processExpiredRaffles();

      expect(ticketsService.refundTickets).toHaveBeenCalledWith('raffle-1');
      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: { estado: 'CANCELADA' },
      });
      expect(prisma.priceReduction.create).toHaveBeenCalled();
      expect(
        notificationsService.sendPriceReductionSuggestion,
      ).toHaveBeenCalled();
    });

    it('should not cancel raffle when wallet refunds fail', async () => {
      prisma.raffle.findMany.mockResolvedValue([
        {
          id: 'raffle-1',
          estado: 'ACTIVA',
          totalTickets: 10,
          tickets: Array.from({ length: 4 }, (_, i) => ({
            id: `p-${i}`,
            estado: 'PAGADO',
          })),
          seller: { id: 'seller-1', email: 'seller@test.com' },
        },
      ]);

      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        titulo: 'Test Raffle',
        precioPorTicket: new Prisma.Decimal(500),
        tickets: [
          {
            id: 'ticket-1',
            precioPagado: new Prisma.Decimal(500),
            buyer: { email: 'buyer1@test.com' },
          },
          {
            id: 'ticket-2',
            precioPagado: new Prisma.Decimal(500),
            buyer: { email: 'buyer2@test.com' },
          },
        ],
        seller: { id: 'seller-1', email: 'seller@test.com' },
      });
      ticketsService.refundTickets.mockRejectedValue(
        new Error('refund failed'),
      );

      await service.processExpiredRaffles();

      expect(prisma.raffle.update).not.toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: { estado: 'CANCELADA' },
      });
      expect(prisma.priceReduction.create).not.toHaveBeenCalled();
    });
  });

  describe('processRemindersAndReleases', () => {
    it('should process due payouts in hourly task', async () => {
      prisma.raffle.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      payoutsService.processDuePayouts.mockResolvedValue(undefined);

      await service.processRemindersAndReleases();

      expect(payoutsService.processDuePayouts).toHaveBeenCalled();
    });

    it('should send one seller reminder when an active raffle is about to expire', async () => {
      const deadline = new Date('2026-05-01T12:00:00.000Z');
      prisma.raffle.findMany
        .mockResolvedValueOnce([
          {
            id: 'raffle-1',
            sellerId: 'seller-1',
            titulo: 'Rifa por vencer QA',
            fechaLimiteSorteo: deadline,
            totalTickets: 10,
            tickets: [{ id: 'ticket-1' }, { id: 'ticket-2' }],
            seller: { id: 'seller-1', email: 'seller@test.com' },
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.processRemindersAndReleases();

      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'seller-1',
          type: 'INFO',
          title: 'Rifa por vencer',
          actionUrl: '/raffle/raffle-1',
        },
      });
      expect(notificationsService.create).toHaveBeenCalledWith(
        'seller-1',
        'INFO',
        'Rifa por vencer',
        'Tu rifa "Rifa por vencer QA" vence pronto. Revisá el avance de ventas.',
        '/raffle/raffle-1',
      );
      expect(
        notificationsService.sendRaffleExpirationReminder,
      ).toHaveBeenCalledWith('seller@test.com', {
        raffleName: 'Rifa por vencer QA',
        deadline,
        soldTickets: 2,
        totalTickets: 10,
      });
    });

    it('should not resend the raffle expiration reminder if one already exists', async () => {
      prisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notification-1',
      });
      prisma.raffle.findMany
        .mockResolvedValueOnce([
          {
            id: 'raffle-1',
            sellerId: 'seller-1',
            titulo: 'Rifa por vencer QA',
            fechaLimiteSorteo: new Date('2026-05-01T12:00:00.000Z'),
            totalTickets: 10,
            tickets: [],
            seller: { id: 'seller-1', email: 'seller@test.com' },
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.processRemindersAndReleases();

      expect(notificationsService.create).not.toHaveBeenCalled();
      expect(
        notificationsService.sendRaffleExpirationReminder,
      ).not.toHaveBeenCalled();
    });

    it('should auto-confirm and process payout after 7 days without dispute', async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      prisma.raffle.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'raffle-1',
            estado: 'SORTEADA',
            fechaSorteoReal: sevenDaysAgo,
            deliveryStatus: 'SHIPPED',
            paymentReleasedAt: null,
            seller: { id: 'seller-1', email: 'seller@test.com' },
            dispute: null,
            payout: null,
          },
        ])
        .mockResolvedValueOnce([]);
      prisma.raffle.update.mockResolvedValue({});
      payoutsService.processPayoutForRaffle.mockResolvedValue({});

      await service.processRemindersAndReleases();

      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: {
          estado: 'EN_ENTREGA',
          deliveryStatus: 'CONFIRMED',
          confirmedAt: expect.any(Date),
        },
      });
      expect(payoutsService.processPayoutForRaffle).toHaveBeenCalledWith(
        'raffle-1',
      );
    });

    it('should skip auto-release when dispute is active', async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      prisma.raffle.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'raffle-1',
            estado: 'SORTEADA',
            fechaSorteoReal: sevenDaysAgo,
            deliveryStatus: 'DELIVERED',
            paymentReleasedAt: null,
            seller: { id: 'seller-1', email: 'seller@test.com' },
            dispute: { id: 'd-1', resolvedAt: null },
            payout: null,
          },
        ])
        .mockResolvedValueOnce([]);

      await service.processRemindersAndReleases();

      expect(prisma.raffle.update).not.toHaveBeenCalled();
      expect(payoutsService.processPayoutForRaffle).not.toHaveBeenCalled();
    });
  });
});
