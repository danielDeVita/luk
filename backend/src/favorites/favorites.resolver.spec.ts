import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesResolver } from './favorites.resolver';
import { FavoritesService } from './favorites.service';

describe('FavoritesResolver', () => {
  let resolver: FavoritesResolver;
  let favoritesService: any;

  const mockFavoritesService = {
    getUserFavorites: jest.fn(),
    isFavorite: jest.fn(),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
  };

  const createTestUser = () => ({
    id: 'user-1',
  });

  const createTestFavorite = (overrides = {}) => ({
    id: 'favorite-1',
    userId: 'user-1',
    raffleId: 'raffle-1',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesResolver,
        { provide: FavoritesService, useValue: mockFavoritesService },
      ],
    }).compile();

    resolver = module.get<FavoritesResolver>(FavoritesResolver);
    favoritesService = module.get(FavoritesService);
  });

  describe('myFavorites', () => {
    it('should return all favorites for current user', async () => {
      const user = createTestUser();
      const favorites = [
        createTestFavorite({ id: 'fav-1', raffleId: 'raffle-1' }),
        createTestFavorite({ id: 'fav-2', raffleId: 'raffle-2' }),
        createTestFavorite({ id: 'fav-3', raffleId: 'raffle-3' }),
      ];

      favoritesService.getUserFavorites.mockResolvedValue(favorites);

      const result = await resolver.myFavorites(user);

      expect(result).toEqual(favorites);
      expect(result).toHaveLength(3);
      expect(favoritesService.getUserFavorites).toHaveBeenCalledWith(user.id);
    });

    it('should return empty array when user has no favorites', async () => {
      const user = createTestUser();

      favoritesService.getUserFavorites.mockResolvedValue([]);

      const result = await resolver.myFavorites(user);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should call service with correct user ID', async () => {
      const user = { id: 'custom-user-id' };

      favoritesService.getUserFavorites.mockResolvedValue([]);

      await resolver.myFavorites(user);

      expect(favoritesService.getUserFavorites).toHaveBeenCalledWith(
        'custom-user-id',
      );
    });
  });

  describe('isFavorite', () => {
    it('should return true when raffle is favorited', async () => {
      const user = createTestUser();
      const raffleId = 'raffle-1';

      favoritesService.isFavorite.mockResolvedValue(true);

      const result = await resolver.isFavorite(user, raffleId);

      expect(result).toBe(true);
      expect(favoritesService.isFavorite).toHaveBeenCalledWith(
        user.id,
        raffleId,
      );
    });

    it('should return false when raffle is not favorited', async () => {
      const user = createTestUser();
      const raffleId = 'raffle-2';

      favoritesService.isFavorite.mockResolvedValue(false);

      const result = await resolver.isFavorite(user, raffleId);

      expect(result).toBe(false);
      expect(favoritesService.isFavorite).toHaveBeenCalledWith(
        user.id,
        raffleId,
      );
    });
  });

  describe('addFavorite', () => {
    it('should add raffle to favorites', async () => {
      const user = createTestUser();
      const raffleId = 'raffle-1';
      const favorite = createTestFavorite({ raffleId });

      favoritesService.addFavorite.mockResolvedValue(favorite);

      const result = await resolver.addFavorite(user, raffleId);

      expect(result).toEqual(favorite);
      expect(favoritesService.addFavorite).toHaveBeenCalledWith(
        user.id,
        raffleId,
      );
    });

    it('should create favorite with correct user and raffle IDs', async () => {
      const user = { id: 'specific-user' };
      const raffleId = 'specific-raffle';

      favoritesService.addFavorite.mockResolvedValue(
        createTestFavorite({
          userId: 'specific-user',
          raffleId: 'specific-raffle',
        }),
      );

      await resolver.addFavorite(user, raffleId);

      expect(favoritesService.addFavorite).toHaveBeenCalledWith(
        'specific-user',
        'specific-raffle',
      );
    });
  });

  describe('removeFavorite', () => {
    it('should remove raffle from favorites', async () => {
      const user = createTestUser();
      const raffleId = 'raffle-1';

      favoritesService.removeFavorite.mockResolvedValue(true);

      const result = await resolver.removeFavorite(user, raffleId);

      expect(result).toBe(true);
      expect(favoritesService.removeFavorite).toHaveBeenCalledWith(
        user.id,
        raffleId,
      );
    });

    it('should return false when favorite does not exist', async () => {
      const user = createTestUser();
      const raffleId = 'raffle-2';

      favoritesService.removeFavorite.mockResolvedValue(false);

      const result = await resolver.removeFavorite(user, raffleId);

      expect(result).toBe(false);
    });

    it('should call service with correct parameters', async () => {
      const user = { id: 'user-123' };
      const raffleId = 'raffle-456';

      favoritesService.removeFavorite.mockResolvedValue(true);

      await resolver.removeFavorite(user, raffleId);

      expect(favoritesService.removeFavorite).toHaveBeenCalledWith(
        'user-123',
        'raffle-456',
      );
    });
  });
});
