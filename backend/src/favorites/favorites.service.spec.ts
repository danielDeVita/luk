import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

type MockPrismaService = {
  raffle: {
    findUnique: jest.Mock;
  };
  favorite: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
};

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prisma: MockPrismaService;

  const mockPrismaService = (): MockPrismaService => ({
    raffle: {
      findUnique: jest.fn(),
    },
    favorite: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
  });

  describe('addFavorite', () => {
    it('should add raffle to favorites', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        isDeleted: false,
      };

      const mockFavorite = {
        id: 'fav-1',
        userId: 'user-1',
        raffleId: 'raffle-1',
        raffle: {
          id: 'raffle-1',
          titulo: 'iPhone 15 Pro',
          product: { id: 'prod-1' },
          seller: { id: 'seller-1', nombre: 'Vendedor' },
        },
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.favorite.create.mockResolvedValue(mockFavorite);

      const result = await service.addFavorite('user-1', 'raffle-1');

      expect(prisma.raffle.findUnique).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        select: { id: true, sellerId: true, isDeleted: true },
      });
      expect(prisma.favorite.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', raffleId: 'raffle-1' },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockFavorite);
    });

    it('should return existing favorite if already added', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        isDeleted: false,
      };

      const mockExistingFavorite = {
        id: 'fav-1',
        userId: 'user-1',
        raffleId: 'raffle-1',
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.favorite.findUnique.mockResolvedValue(mockExistingFavorite);

      const result = await service.addFavorite('user-1', 'raffle-1');

      expect(prisma.favorite.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockExistingFavorite);
    });

    it('should throw NotFoundException if raffle not found', async () => {
      prisma.raffle.findUnique.mockResolvedValue(null);

      await expect(service.addFavorite('user-1', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if raffle is deleted', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'seller-1',
        isDeleted: true,
      });

      await expect(service.addFavorite('user-1', 'raffle-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user tries to favorite own raffle', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'user-1',
        isDeleted: false,
      });

      await expect(service.addFavorite('user-1', 'raffle-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeFavorite', () => {
    it('should remove raffle from favorites', async () => {
      const mockFavorite = {
        id: 'fav-1',
        userId: 'user-1',
        raffleId: 'raffle-1',
      };

      prisma.favorite.findUnique.mockResolvedValue(mockFavorite);
      prisma.favorite.delete.mockResolvedValue(mockFavorite);

      const result = await service.removeFavorite('user-1', 'raffle-1');

      expect(prisma.favorite.findUnique).toHaveBeenCalledWith({
        where: {
          userId_raffleId: { userId: 'user-1', raffleId: 'raffle-1' },
        },
      });
      expect(prisma.favorite.delete).toHaveBeenCalledWith({
        where: {
          userId_raffleId: { userId: 'user-1', raffleId: 'raffle-1' },
        },
      });
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if favorite not found', async () => {
      prisma.favorite.findUnique.mockResolvedValue(null);

      await expect(
        service.removeFavorite('user-1', 'raffle-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserFavorites', () => {
    it('should return all user favorites with raffle details', async () => {
      const mockFavorites = [
        {
          id: 'fav-1',
          userId: 'user-1',
          raffleId: 'raffle-1',
          raffle: {
            id: 'raffle-1',
            titulo: 'iPhone 15 Pro',
            product: { id: 'prod-1', nombre: 'iPhone' },
            seller: { id: 'seller-1', nombre: 'Vendedor' },
            _count: { tickets: 50 },
          },
        },
        {
          id: 'fav-2',
          userId: 'user-1',
          raffleId: 'raffle-2',
          raffle: {
            id: 'raffle-2',
            titulo: 'MacBook Pro',
            product: { id: 'prod-2', nombre: 'MacBook' },
            seller: { id: 'seller-2', nombre: 'Otro Vendedor' },
            _count: { tickets: 30 },
          },
        },
      ];

      prisma.favorite.findMany.mockResolvedValue(mockFavorites);

      const result = await service.getUserFavorites('user-1');

      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: expect.objectContaining({
          raffle: expect.any(Object),
        }),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockFavorites);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if user has no favorites', async () => {
      prisma.favorite.findMany.mockResolvedValue([]);

      const result = await service.getUserFavorites('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('isFavorite', () => {
    it('should return true if raffle is favorited', async () => {
      prisma.favorite.findUnique.mockResolvedValue({
        id: 'fav-1',
        userId: 'user-1',
        raffleId: 'raffle-1',
      });

      const result = await service.isFavorite('user-1', 'raffle-1');

      expect(result).toBe(true);
    });

    it('should return false if raffle is not favorited', async () => {
      prisma.favorite.findUnique.mockResolvedValue(null);

      const result = await service.isFavorite('user-1', 'raffle-1');

      expect(result).toBe(false);
    });
  });

  describe('getFavoriteCount', () => {
    it('should return favorite count for a raffle', async () => {
      prisma.favorite.count.mockResolvedValue(42);

      const result = await service.getFavoriteCount('raffle-1');

      expect(prisma.favorite.count).toHaveBeenCalledWith({
        where: { raffleId: 'raffle-1' },
      });
      expect(result).toBe(42);
    });

    it('should return 0 if raffle has no favorites', async () => {
      prisma.favorite.count.mockResolvedValue(0);

      const result = await service.getFavoriteCount('raffle-1');

      expect(result).toBe(0);
    });
  });
});
