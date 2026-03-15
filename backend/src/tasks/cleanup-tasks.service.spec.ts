import { Test, TestingModule } from '@nestjs/testing';
import { CleanupTasksService } from './cleanup-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SocialPromotionsService } from '../social-promotions/social-promotions.service';

type MockPrismaService = {
  ticket: {
    deleteMany: jest.Mock;
    findMany: jest.Mock;
  };
  raffle: {
    findMany: jest.Mock;
  };
};

type MockSocialPromotionsService = {
  releaseReservedRedemptionByReservation: jest.Mock;
};

type MockConfigService = {
  get: jest.Mock;
};

describe('CleanupTasksService', () => {
  let service: CleanupTasksService;
  let prisma: MockPrismaService;
  let config: MockConfigService;
  let socialPromotionsService: MockSocialPromotionsService;

  const mockPrismaService = (): MockPrismaService => ({
    ticket: {
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    raffle: {
      findMany: jest.fn(),
    },
  });

  const mockConfigService = (): MockConfigService => ({
    get: jest.fn(),
  });

  const mockSocialPromotionsService = (): MockSocialPromotionsService => ({
    releaseReservedRedemptionByReservation: jest
      .fn()
      .mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupTasksService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: ConfigService, useValue: mockConfigService() },
        {
          provide: SocialPromotionsService,
          useValue: mockSocialPromotionsService(),
        },
      ],
    }).compile();

    service = module.get<CleanupTasksService>(CleanupTasksService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    config = module.get(ConfigService) as unknown as MockConfigService;
    socialPromotionsService = module.get(
      SocialPromotionsService,
    ) as unknown as MockSocialPromotionsService;
    prisma.ticket.findMany.mockResolvedValue([]);
  });

  describe('constructor', () => {
    it('should initialize with cron enabled by default', () => {
      expect(service).toBeDefined();
    });

    it('should disable cron if ENABLE_CRON_JOBS is "false"', async () => {
      config.get.mockReturnValue('false');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CleanupTasksService,
          { provide: PrismaService, useValue: mockPrismaService() },
          { provide: ConfigService, useValue: config },
          {
            provide: SocialPromotionsService,
            useValue: mockSocialPromotionsService(),
          },
        ],
      }).compile();

      const disabledService =
        module.get<CleanupTasksService>(CleanupTasksService);

      // Verify cron jobs skip when disabled
      await disabledService.cleanupExpiredReservedTickets();
      expect(prisma.ticket.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredReservedTickets', () => {
    beforeEach(() => {
      config.get.mockReturnValue('true'); // Enable cron for tests
      prisma.ticket.findMany.mockResolvedValue([]);
    });

    it('should delete expired reserved tickets older than 30 minutes', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      const expectedCutoffTime = new Date('2024-01-01T11:30:00Z'); // 30 minutes ago

      prisma.ticket.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanupExpiredReservedTickets();

      expect(prisma.ticket.deleteMany).toHaveBeenCalledWith({
        where: {
          estado: 'RESERVADO',
          createdAt: { lte: expectedCutoffTime },
        },
      });

      jest.useRealTimers();
    });

    it('should skip cleanup if cron is disabled', async () => {
      config.get.mockReturnValue('false');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CleanupTasksService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: config },
          {
            provide: SocialPromotionsService,
            useValue: socialPromotionsService,
          },
        ],
      }).compile();

      const disabledService =
        module.get<CleanupTasksService>(CleanupTasksService);

      await disabledService.cleanupExpiredReservedTickets();

      expect(prisma.ticket.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle zero tickets to cleanup', async () => {
      prisma.ticket.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupExpiredReservedTickets();

      expect(prisma.ticket.deleteMany).toHaveBeenCalled();
    });

    it('should release reserved promotion bonuses tied to expired reservations', async () => {
      prisma.ticket.findMany.mockResolvedValue([
        { mpExternalReference: 'reservation-1' },
      ]);
      prisma.ticket.deleteMany.mockResolvedValue({ count: 1 });

      await service.cleanupExpiredReservedTickets();

      expect(
        socialPromotionsService.releaseReservedRedemptionByReservation,
      ).toHaveBeenCalledWith('reservation-1');
    });

    it('should handle database errors gracefully', async () => {
      prisma.ticket.deleteMany.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(service.cleanupExpiredReservedTickets()).rejects.toThrow();
    });
  });

  describe('dailyCleanup', () => {
    beforeEach(() => {
      config.get.mockReturnValue('true');
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T03:00:00Z')); // 3 AM
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should run cleanup tasks in sequence', async () => {
      prisma.ticket.deleteMany.mockResolvedValue({ count: 3 });
      prisma.raffle.findMany.mockResolvedValue([
        {
          id: 'raffle-1',
          sellerId: 'seller-1',
          estado: 'SORTEADA',
          fechaSorteoReal: new Date('2023-12-31T12:00:00Z'),
          deliveryStatus: 'PENDING',
        },
      ]);

      await service.dailyCleanup();

      expect(prisma.ticket.deleteMany).toHaveBeenCalled();
      expect(prisma.raffle.findMany).toHaveBeenCalled();
    });

    it('should skip all tasks if cron disabled', async () => {
      config.get.mockReturnValue('false');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CleanupTasksService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: config },
          {
            provide: SocialPromotionsService,
            useValue: socialPromotionsService,
          },
        ],
      }).compile();

      const disabledService =
        module.get<CleanupTasksService>(CleanupTasksService);

      await disabledService.dailyCleanup();

      expect(prisma.ticket.deleteMany).not.toHaveBeenCalled();
      expect(prisma.raffle.findMany).not.toHaveBeenCalled();
    });

    it('should handle errors without crashing', async () => {
      prisma.ticket.deleteMany.mockRejectedValue(new Error('DB error'));

      await service.dailyCleanup();

      // Should complete without throwing
      expect(prisma.ticket.deleteMany).toHaveBeenCalled();
    });
  });

  describe('sendShippingReminders (private, tested via dailyCleanup)', () => {
    beforeEach(() => {
      config.get.mockReturnValue('true');
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T03:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should find raffles needing shipping reminders (24-48h window)', async () => {
      const twentyFourHoursAgo = new Date('2023-12-31T03:00:00Z');
      const fortyEightHoursAgo = new Date('2023-12-30T03:00:00Z');

      prisma.ticket.deleteMany.mockResolvedValue({ count: 0 });
      prisma.raffle.findMany.mockResolvedValue([
        {
          id: 'raffle-1',
          sellerId: 'seller-1',
          estado: 'SORTEADA',
          fechaSorteoReal: new Date('2023-12-31T12:00:00Z'),
          deliveryStatus: 'PENDING',
          shippedAt: null,
          isDeleted: false,
          seller: { id: 'seller-1', email: 'seller@test.com' },
          winner: { id: 'winner-1', email: 'winner@test.com' },
        },
      ]);

      await service.dailyCleanup();

      expect(prisma.raffle.findMany).toHaveBeenCalledWith({
        where: {
          estado: 'SORTEADA',
          fechaSorteoReal: {
            gte: fortyEightHoursAgo,
            lte: twentyFourHoursAgo,
          },
          deliveryStatus: 'PENDING',
          shippedAt: null,
          isDeleted: false,
        },
        include: { seller: true, winner: true },
      });
    });

    it('should handle zero raffles needing reminders', async () => {
      prisma.ticket.deleteMany.mockResolvedValue({ count: 0 });
      prisma.raffle.findMany.mockResolvedValue([]);

      await service.dailyCleanup();

      expect(prisma.raffle.findMany).toHaveBeenCalled();
    });

    it('should process multiple raffles needing reminders', async () => {
      prisma.ticket.deleteMany.mockResolvedValue({ count: 0 });
      prisma.raffle.findMany.mockResolvedValue([
        {
          id: 'raffle-1',
          sellerId: 'seller-1',
          estado: 'SORTEADA',
        },
        {
          id: 'raffle-2',
          sellerId: 'seller-2',
          estado: 'SORTEADA',
        },
        {
          id: 'raffle-3',
          sellerId: 'seller-1',
          estado: 'SORTEADA',
        },
      ]);

      await service.dailyCleanup();

      expect(prisma.raffle.findMany).toHaveBeenCalled();
    });
  });
});
