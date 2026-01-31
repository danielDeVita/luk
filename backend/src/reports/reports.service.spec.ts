import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

type MockPrismaService = {
  raffle: {
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  report: {
    findUnique: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  user: {
    update: jest.Mock;
  };
};

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: MockPrismaService;

  const mockPrismaService = (): MockPrismaService => ({
    raffle: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    report: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
  });

  describe('createReport', () => {
    it('should create a report for a raffle', async () => {
      const input = {
        userId: 'user-1',
        raffleId: 'raffle-1',
        reason: 'Contenido inapropiado',
      };

      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        estado: 'ACTIVA',
        sellerId: 'seller-1',
        isHidden: false,
      });
      prisma.report.findUnique.mockResolvedValue(null);
      prisma.report.count.mockResolvedValue(1);
      prisma.report.create.mockResolvedValue({
        id: 'report-1',
        raffleId: 'raffle-1',
        reporterId: 'user-1',
        reason: input.reason,
      });

      const result = await service.createReport(
        input.userId,
        input.raffleId,
        input.reason,
      );

      expect(prisma.raffle.findUnique).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        select: { id: true, estado: true, sellerId: true, isHidden: true },
      });
      expect(prisma.report.create).toHaveBeenCalledWith({
        data: {
          raffleId: 'raffle-1',
          reporterId: 'user-1',
          reason: 'Contenido inapropiado',
        },
      });
      expect(result.id).toBe('report-1');
    });

    it('should throw NotFoundException if raffle not found', async () => {
      prisma.raffle.findUnique.mockResolvedValue(null);

      await expect(
        service.createReport('user-1', 'invalid-id', 'Reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user tries to report own raffle', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        estado: 'ACTIVA',
        sellerId: 'user-1',
        isHidden: false,
      });

      await expect(
        service.createReport('user-1', 'raffle-1', 'Reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if raffle is not ACTIVA', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        estado: 'FINALIZADA',
        sellerId: 'seller-1',
        isHidden: false,
      });

      await expect(
        service.createReport('user-1', 'raffle-1', 'Reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user already reported raffle', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        estado: 'ACTIVA',
        sellerId: 'seller-1',
        isHidden: false,
      });
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-existing',
        raffleId: 'raffle-1',
        reporterId: 'user-1',
      });

      await expect(
        service.createReport('user-1', 'raffle-1', 'Reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should auto-hide raffle after 3 reports', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        estado: 'ACTIVA',
        sellerId: 'seller-1',
        isHidden: false,
      });
      prisma.report.findUnique.mockResolvedValue(null);
      prisma.report.count.mockResolvedValue(3);
      prisma.report.create.mockResolvedValue({
        id: 'report-3',
        raffleId: 'raffle-1',
        reporterId: 'user-1',
        reason: 'Test',
      });
      prisma.raffle.update.mockResolvedValue({});

      await service.createReport('user-1', 'raffle-1', 'Test');

      expect(prisma.report.count).toHaveBeenCalledWith({
        where: { raffleId: 'raffle-1', reviewed: false },
      });
      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: {
          isHidden: true,
          hiddenReason: 'Auto-hidden: 3 reports received',
        },
      });
    });

    it('should not auto-hide raffle with fewer than 3 reports', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        estado: 'ACTIVA',
        sellerId: 'seller-1',
        isHidden: false,
      });
      prisma.report.findUnique.mockResolvedValue(null);
      prisma.report.count.mockResolvedValue(2);
      prisma.report.create.mockResolvedValue({
        id: 'report-2',
        raffleId: 'raffle-1',
        reporterId: 'user-1',
        reason: 'Test',
      });

      await service.createReport('user-1', 'raffle-1', 'Test');

      expect(prisma.raffle.update).not.toHaveBeenCalled();
    });
  });

  describe('getReports', () => {
    it('should return reports with filters', async () => {
      const mockReports = [
        {
          id: 'report-1',
          raffleId: 'raffle-1',
          reporterId: 'user-1',
          reason: 'Test',
          reviewed: false,
          raffle: { id: 'raffle-1', titulo: 'Rifa 1', isHidden: false },
          reporter: { id: 'user-1', email: 'user@test.com', nombre: 'User' },
        },
      ];

      prisma.report.findMany.mockResolvedValue(mockReports);

      const result = await service.getReports({
        reviewed: false,
        raffleId: 'raffle-1',
      });

      expect(prisma.report.findMany).toHaveBeenCalledWith({
        where: { reviewed: false, raffleId: 'raffle-1' },
        include: {
          raffle: { select: { id: true, titulo: true, isHidden: true } },
          reporter: { select: { id: true, email: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockReports);
    });

    it('should return all reports when no filters provided', async () => {
      const mockReports = [
        {
          id: 'report-1',
          reviewed: true,
        },
        {
          id: 'report-2',
          reviewed: false,
        },
      ];

      prisma.report.findMany.mockResolvedValue(mockReports);

      const result = await service.getReports({});

      expect(prisma.report.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          raffle: { select: { id: true, titulo: true, isHidden: true } },
          reporter: { select: { id: true, email: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockReports);
    });
  });

  describe('reviewReport', () => {
    it('should throw NotFoundException if report not found', async () => {
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewReport('invalid-id', 'Admin notes', 'DISMISS'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should dismiss report without taking action', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        raffleId: 'raffle-1',
        raffle: {
          id: 'raffle-1',
          sellerId: 'seller-1',
          seller: { id: 'seller-1' },
        },
      });
      prisma.report.update.mockResolvedValue({});

      const result = await service.reviewReport(
        'report-1',
        'No violation found',
        'DISMISS',
      );

      expect(prisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: {
          reviewed: true,
          reviewedAt: expect.any(Date),
          adminNotes: 'No violation found',
        },
      });
      expect(prisma.raffle.update).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, action: 'DISMISS' });
    });

    it('should hide raffle when action is HIDE_RAFFLE', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        raffleId: 'raffle-1',
        raffle: {
          id: 'raffle-1',
          sellerId: 'seller-1',
          seller: { id: 'seller-1' },
        },
      });
      prisma.report.update.mockResolvedValue({});
      prisma.raffle.update.mockResolvedValue({});

      const result = await service.reviewReport(
        'report-1',
        'Contains inappropriate content',
        'HIDE_RAFFLE',
      );

      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: {
          isHidden: true,
          hiddenReason: 'Hidden by admin: Contains inappropriate content',
        },
      });
      expect(result).toEqual({ success: true, action: 'HIDE_RAFFLE' });
    });

    it('should ban seller and hide all their raffles when action is BAN_SELLER', async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        raffleId: 'raffle-1',
        raffle: {
          id: 'raffle-1',
          sellerId: 'seller-1',
          seller: { id: 'seller-1' },
        },
      });
      prisma.report.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      prisma.raffle.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.reviewReport(
        'report-1',
        'Repeated violations',
        'BAN_SELLER',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'seller-1' },
        data: { role: 'BANNED' },
      });
      expect(prisma.raffle.updateMany).toHaveBeenCalledWith({
        where: { sellerId: 'seller-1' },
        data: { isHidden: true, hiddenReason: 'Seller banned' },
      });
      expect(result).toEqual({ success: true, action: 'BAN_SELLER' });
    });
  });

  describe('unhideRaffle', () => {
    it('should unhide raffle and mark reports as reviewed', async () => {
      prisma.raffle.update.mockResolvedValue({});
      prisma.report.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.unhideRaffle(
        'raffle-1',
        'False alarm, content is appropriate',
      );

      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: { isHidden: false, hiddenReason: null },
      });
      expect(prisma.report.updateMany).toHaveBeenCalledWith({
        where: { raffleId: 'raffle-1', reviewed: false },
        data: {
          reviewed: true,
          reviewedAt: expect.any(Date),
          adminNotes: 'Raffle unhidden: False alarm, content is appropriate',
        },
      });
      expect(result).toEqual({ success: true });
    });
  });
});
