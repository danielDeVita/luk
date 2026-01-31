import { Test, TestingModule } from '@nestjs/testing';
import { ReputationService } from './reputation.service';
import { PrismaService } from '../prisma/prisma.service';
import { SellerLevel } from '@prisma/client';

type MockPrismaService = {
  raffle: {
    count: jest.Mock;
  };
  review: {
    findMany: jest.Mock;
  };
  dispute: {
    count: jest.Mock;
  };
  userReputation: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
  };
};

describe('ReputationService', () => {
  let service: ReputationService;
  let prisma: MockPrismaService;

  const mockPrismaService = (): MockPrismaService => ({
    raffle: {
      count: jest.fn(),
    },
    review: {
      findMany: jest.fn(),
    },
    dispute: {
      count: jest.fn(),
    },
    userReputation: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReputationService,
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();

    service = module.get<ReputationService>(ReputationService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
  });

  describe('recalculateSellerReputation', () => {
    it('should calculate NUEVO level for new sellers with no sales', async () => {
      prisma.raffle.count.mockResolvedValue(0);
      prisma.review.findMany.mockResolvedValue([]);
      prisma.dispute.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateSellerReputation('seller-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith({
        where: { userId: 'seller-1' },
        create: expect.objectContaining({
          nivelVendedor: SellerLevel.NUEVO,
          maxRifasSimultaneas: 3,
          totalVentasCompletadas: 0,
        }),
        update: expect.objectContaining({
          nivelVendedor: SellerLevel.NUEVO,
          maxRifasSimultaneas: 3,
        }),
      });
    });

    it('should calculate BRONCE level for sellers with 5+ sales', async () => {
      prisma.raffle.count.mockResolvedValue(5);
      prisma.review.findMany.mockResolvedValue([
        { rating: 4 },
        { rating: 5 },
        { rating: 4 },
      ]);
      prisma.dispute.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateSellerReputation('seller-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            nivelVendedor: SellerLevel.BRONCE,
            maxRifasSimultaneas: 5,
          }),
        }),
      );
    });

    it('should calculate PLATA level for sellers with 20+ sales and good rating', async () => {
      prisma.raffle.count.mockResolvedValue(20);
      prisma.review.findMany.mockResolvedValue([
        { rating: 4.5 },
        { rating: 5 },
        { rating: 4 },
      ]);
      prisma.dispute.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1); // 4 won, 1 lost (20% lost ratio)

      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateSellerReputation('seller-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            nivelVendedor: SellerLevel.PLATA,
            maxRifasSimultaneas: 7,
          }),
        }),
      );
    });

    it('should calculate ORO level for sellers with 50+ sales and excellent metrics', async () => {
      prisma.raffle.count.mockResolvedValue(50);
      prisma.review.findMany.mockResolvedValue([
        { rating: 5 },
        { rating: 4.5 },
        { rating: 5 },
      ]);
      prisma.dispute.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1); // 5 won, 1 lost (16% lost ratio)

      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateSellerReputation('seller-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            nivelVendedor: SellerLevel.ORO,
            maxRifasSimultaneas: 10,
          }),
        }),
      );
    });

    it('should demote to NUEVO if dispute lost ratio > 50%', async () => {
      prisma.raffle.count.mockResolvedValue(30);
      prisma.review.findMany.mockResolvedValue([{ rating: 4.5 }]);
      prisma.dispute.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3); // 1 won, 3 lost (75% lost ratio)

      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateSellerReputation('seller-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            nivelVendedor: SellerLevel.NUEVO,
          }),
        }),
      );
    });

    it('should require rating >= 3.5 to advance beyond NUEVO', async () => {
      prisma.raffle.count.mockResolvedValue(20);
      prisma.review.findMany.mockResolvedValue([
        { rating: 2 },
        { rating: 3 },
        { rating: 2.5 },
      ]); // Avg = 2.5
      prisma.dispute.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateSellerReputation('seller-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            nivelVendedor: SellerLevel.NUEVO,
          }),
        }),
      );
    });

    it('should calculate average rating correctly', async () => {
      prisma.raffle.count.mockResolvedValue(10);
      prisma.review.findMany.mockResolvedValue([
        { rating: 4 },
        { rating: 5 },
        { rating: 3 },
      ]);
      prisma.dispute.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateSellerReputation('seller-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            ratingPromedioVendedor: 4, // (4 + 5 + 3) / 3
          }),
        }),
      );
    });
  });

  describe('recalculateBuyerReputation', () => {
    it('should calculate buyer reputation with completed purchases', async () => {
      prisma.raffle.count.mockResolvedValue(5);
      prisma.dispute.count.mockResolvedValue(1);
      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateBuyerReputation('buyer-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith({
        where: { userId: 'buyer-1' },
        create: {
          userId: 'buyer-1',
          totalComprasCompletadas: 5,
          disputasComoCompradorAbiertas: 1,
        },
        update: {
          totalComprasCompletadas: 5,
          disputasComoCompradorAbiertas: 1,
        },
      });
    });

    it('should handle buyer with no purchases', async () => {
      prisma.raffle.count.mockResolvedValue(0);
      prisma.dispute.count.mockResolvedValue(0);
      prisma.userReputation.upsert.mockResolvedValue({});

      await service.recalculateBuyerReputation('buyer-1');

      expect(prisma.userReputation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            totalComprasCompletadas: 0,
            disputasComoCompradorAbiertas: 0,
          }),
        }),
      );
    });
  });

  describe('getReputationSummary', () => {
    it('should return reputation summary for existing user', async () => {
      prisma.userReputation.findUnique.mockResolvedValue({
        userId: 'user-1',
        nivelVendedor: SellerLevel.PLATA,
        totalVentasCompletadas: 25,
        totalComprasCompletadas: 10,
        ratingPromedioVendedor: 4.5,
        disputasComoVendedorGanadas: 3,
        disputasComoVendedorPerdidas: 1,
        maxRifasSimultaneas: 7,
      });

      const result = await service.getReputationSummary('user-1');

      expect(result).toEqual({
        nivel: SellerLevel.PLATA,
        totalVentas: 25,
        totalCompras: 10,
        rating: 4.5,
        disputasGanadas: 3,
        disputasPerdidas: 1,
        maxRifasSimultaneas: 7,
      });
    });

    it('should return default values for user without reputation', async () => {
      prisma.userReputation.findUnique.mockResolvedValue(null);

      const result = await service.getReputationSummary('user-1');

      expect(result).toEqual({
        nivel: SellerLevel.NUEVO,
        totalVentas: 0,
        totalCompras: 0,
        rating: null,
        disputasGanadas: 0,
        disputasPerdidas: 0,
        maxRifasSimultaneas: 3,
      });
    });
  });

  describe('canSellerCreateRaffle', () => {
    it('should allow seller with active raffles below limit', async () => {
      prisma.userReputation.findUnique.mockResolvedValue({
        maxRifasSimultaneas: 5,
      });
      prisma.raffle.count.mockResolvedValue(3);

      const result = await service.canSellerCreateRaffle('seller-1');

      expect(result).toEqual({ allowed: true });
    });

    it('should deny seller at raffle limit', async () => {
      prisma.userReputation.findUnique.mockResolvedValue({
        maxRifasSimultaneas: 5,
      });
      prisma.raffle.count.mockResolvedValue(5);

      const result = await service.canSellerCreateRaffle('seller-1');

      expect(result).toEqual({
        allowed: false,
        reason: expect.stringContaining('limite de 5 rifas activas'),
      });
    });

    it('should use default limit of 3 for new sellers', async () => {
      prisma.userReputation.findUnique.mockResolvedValue(null);
      prisma.raffle.count.mockResolvedValue(3);

      const result = await service.canSellerCreateRaffle('seller-1');

      expect(result).toEqual({
        allowed: false,
        reason: expect.stringContaining('limite de 3 rifas activas'),
      });
    });
  });
});
