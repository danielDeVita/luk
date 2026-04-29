import { Test, TestingModule } from '@nestjs/testing';
import { RafflesResolver } from './raffles.resolver';
import { RafflesService } from './raffles.service';
import {
  User,
  UserRole,
  KycStatus,
  SellerPaymentAccountStatus,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

type MockRafflesService = {
  findAll: jest.Mock;
  findOne: jest.Mock;
  findOnePublic: jest.Mock;
  findByUser: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  cancel: jest.Mock;
  markAsShipped: jest.Mock;
  confirmDelivery: jest.Mock;
  extendRaffleDeadline: jest.Mock;
  relaunchWithSuggestedPrice: jest.Mock;
  rejectRaffleWinner: jest.Mock;
  getSellerDashboardStats: jest.Mock;
  bulkCancelRaffles: jest.Mock;
  incrementViewCount: jest.Mock;
};

describe('RafflesResolver', () => {
  let resolver: RafflesResolver;
  let rafflesService: MockRafflesService;

  const mockRafflesService = (): MockRafflesService => ({
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOnePublic: jest.fn(),
    findByUser: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
    markAsShipped: jest.fn(),
    confirmDelivery: jest.fn(),
    extendRaffleDeadline: jest.fn(),
    relaunchWithSuggestedPrice: jest.fn(),
    rejectRaffleWinner: jest.fn(),
    getSellerDashboardStats: jest.fn(),
    bulkCancelRaffles: jest.fn(),
    incrementViewCount: jest.fn(),
  });

  const mockUser = (overrides?: Partial<User>): User =>
    ({
      id: 'user-1',
      email: 'test@example.com',
      nombre: 'Test',
      apellido: 'User',
      role: UserRole.USER,
      kycStatus: KycStatus.VERIFIED,
      sellerPaymentAccountStatus: SellerPaymentAccountStatus.CONNECTED,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
      googleId: null,
      avatarUrl: null,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      sellerPaymentAccountId: null,
      termsAcceptedAt: new Date(),
      termsVersion: '1.0',
      fechaNacimiento: null,
      documentType: null,
      documentNumber: null,
      documentFrontUrl: null,
      documentBackUrl: null,
      kycSubmittedAt: null,
      kycVerifiedAt: null,
      kycRejectedReason: null,
      street: '123 Main St',
      streetNumber: '123',
      apartment: null,
      city: 'Buenos Aires',
      province: 'Buenos Aires',
      postalCode: '1000',
      country: 'Argentina',
      phone: null,
      cuitCuil: null,
      defaultSenderAddressId: null,
      passwordHash: null,
      banReason: null,
      bannedAt: null,
      bannedById: null,
      ...overrides,
    }) as any;

  const mockRaffle = {
    id: 'raffle-1',
    titulo: 'iPhone 15 Pro',
    descripcion: 'Brand new iPhone',
    totalTickets: 100,
    precioPorTicket: 100,
    estado: 'ACTIVA',
    fechaSorteo: new Date(),
    sellerId: 'seller-1',
    seller: {
      id: 'seller-1',
      email: 'seller@test.com',
      nombre: 'Seller',
      apellido: 'User',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RafflesResolver,
        { provide: RafflesService, useValue: mockRafflesService() },
      ],
    }).compile();

    resolver = module.get<RafflesResolver>(RafflesResolver);
    rafflesService = module.get(
      RafflesService,
    ) as unknown as MockRafflesService;
  });

  describe('raffles', () => {
    it('should return all raffles with filters', async () => {
      const filters = { categoria: 'ELECTRONICA' };
      rafflesService.findAll.mockResolvedValue({
        raffles: [mockRaffle],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await resolver.raffles(filters);

      expect(rafflesService.findAll).toHaveBeenCalledWith(
        filters,
        undefined,
        undefined,
      );
      expect(result).toEqual([mockRaffle]);
    });
  });

  describe('rafflesPaginated', () => {
    it('should return paginated raffles', async () => {
      const serviceResult = {
        raffles: [mockRaffle],
        total: 1,
        page: 1,
        limit: 10,
      };
      rafflesService.findAll.mockResolvedValue(serviceResult);

      const result = await resolver.rafflesPaginated(
        { categoria: 'ELECTRONICA' },
        { page: 1, limit: 10 },
      );

      expect(rafflesService.findAll).toHaveBeenCalledWith(
        { categoria: 'ELECTRONICA' },
        1,
        10,
      );
      expect(result.items).toEqual([mockRaffle]);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('raffle', () => {
    it('should return a single raffle by ID', async () => {
      rafflesService.findOnePublic.mockResolvedValue(mockRaffle);

      const result = await resolver.raffle('raffle-1');

      expect(rafflesService.findOnePublic).toHaveBeenCalledWith('raffle-1');
      expect(result).toEqual(mockRaffle);
    });

    it('should throw NotFoundException for invalid raffle', async () => {
      rafflesService.findOnePublic.mockRejectedValue(
        new NotFoundException('Raffle not found'),
      );

      await expect(resolver.raffle('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('myRafflesAsSeller', () => {
    it('should return current user raffles', async () => {
      const user = mockUser();
      rafflesService.findByUser.mockResolvedValue([mockRaffle]);

      const result = await resolver.myRafflesAsSeller(user);

      expect(rafflesService.findByUser).toHaveBeenCalledWith(user.id);
      expect(result).toEqual([mockRaffle]);
    });
  });

  describe('createRaffle', () => {
    it('should create raffle and call service', async () => {
      const user = mockUser();
      const createInput = {
        titulo: 'New Raffle',
        descripcion: 'Test',
        totalTickets: 100,
        precioPorTicket: 50,
        fechaSorteo: new Date().toISOString(),
        categoria: 'ELECTRONICA',
      };
      rafflesService.create.mockResolvedValue(mockRaffle);

      const result = await resolver.createRaffle(user, createInput as any);

      expect(rafflesService.create).toHaveBeenCalledWith(user.id, createInput);
      expect(result).toEqual(mockRaffle);
    });
  });

  describe('updateRaffle', () => {
    it('should update raffle', async () => {
      const user = mockUser();
      const updateInput = { titulo: 'Updated Title' };
      const updatedRaffle = {
        ...mockRaffle,
        titulo: 'Updated Title',
      };
      rafflesService.update.mockResolvedValue(updatedRaffle);

      const result = await resolver.updateRaffle(
        user,
        'raffle-1',
        updateInput as any,
      );

      expect(rafflesService.update).toHaveBeenCalledWith(
        'raffle-1',
        user.id,
        updateInput,
      );
      expect(result).toEqual(updatedRaffle);
    });
  });

  describe('cancelRaffle', () => {
    it('should cancel raffle', async () => {
      const user = mockUser();
      rafflesService.cancel.mockResolvedValue({
        ...mockRaffle,
        estado: 'CANCELADA',
      });

      const result = await resolver.cancelRaffle(user, 'raffle-1');

      expect(rafflesService.cancel).toHaveBeenCalledWith('raffle-1', user.id);
      expect(result.estado).toBe('CANCELADA');
    });
  });

  describe('markAsShipped', () => {
    it('should mark raffle as shipped', async () => {
      const user = mockUser();
      rafflesService.markAsShipped.mockResolvedValue({
        ...mockRaffle,
        estado: 'EN_ENTREGA',
      });

      const result = await resolver.markAsShipped(
        user,
        'raffle-1',
        'TRACKING123',
      );

      expect(rafflesService.markAsShipped).toHaveBeenCalledWith(
        'raffle-1',
        user.id,
        'TRACKING123',
      );
      expect(result.estado).toBe('EN_ENTREGA');
    });
  });

  describe('confirmDelivery', () => {
    it('should confirm delivery', async () => {
      const user = mockUser();
      rafflesService.confirmDelivery.mockResolvedValue({
        ...mockRaffle,
        estado: 'FINALIZADA',
      });

      const result = await resolver.confirmDelivery(user, 'raffle-1');

      expect(rafflesService.confirmDelivery).toHaveBeenCalledWith(
        'raffle-1',
        user.id,
      );
      expect(result.estado).toBe('FINALIZADA');
    });
  });

  describe('extendRaffleDeadline', () => {
    it('should extend raffle deadline', async () => {
      const user = mockUser();
      const newDeadline = new Date();
      const extendedRaffle = {
        ...mockRaffle,
        fechaSorteo: newDeadline,
      };
      rafflesService.extendRaffleDeadline.mockResolvedValue(extendedRaffle);

      const result = await resolver.extendRaffleDeadline(
        user,
        'raffle-1',
        newDeadline.toISOString(),
      );

      expect(rafflesService.extendRaffleDeadline).toHaveBeenCalledWith(
        'raffle-1',
        user.id,
        newDeadline,
      );
      expect(result).toEqual(extendedRaffle);
    });
  });

  describe('relaunchRaffleWithSuggestedPrice', () => {
    it('should relaunch raffle with suggested price', async () => {
      const user = mockUser();
      const relaunchInput = {
        raffleId: 'raffle-1',
        newPrice: 80,
        newDeadline: new Date().toISOString(),
      };
      rafflesService.relaunchWithSuggestedPrice.mockResolvedValue(mockRaffle);

      const result = await resolver.relaunchRaffleWithSuggestedPrice(
        user,
        relaunchInput as any,
      );

      expect(rafflesService.relaunchWithSuggestedPrice).toHaveBeenCalledWith(
        user.id,
        relaunchInput,
      );
      expect(result).toEqual(mockRaffle);
    });
  });

  describe('rejectRaffleWinner', () => {
    it('should reject raffle winner (admin only)', async () => {
      const admin = mockUser({ role: UserRole.ADMIN });
      rafflesService.rejectRaffleWinner.mockResolvedValue(mockRaffle);

      const result = await resolver.rejectRaffleWinner(
        admin,
        'raffle-1',
        'Fraud detected',
      );

      expect(rafflesService.rejectRaffleWinner).toHaveBeenCalledWith(
        'raffle-1',
        admin.id,
        'Fraud detected',
      );
      expect(result).toEqual(mockRaffle);
    });
  });

  describe('sellerDashboardStats', () => {
    it('should return seller dashboard statistics', async () => {
      const user = mockUser();
      const stats = {
        activeRaffles: 5,
        totalSales: 10000,
        pendingPayouts: 2,
        completedRaffles: 15,
      };
      rafflesService.getSellerDashboardStats.mockResolvedValue(stats);

      const result = await resolver.sellerDashboardStats(user);

      expect(rafflesService.getSellerDashboardStats).toHaveBeenCalledWith(
        user.id,
      );
      expect(result).toEqual(stats);
    });
  });

  describe('bulkCancelRaffles', () => {
    it('should cancel multiple raffles', async () => {
      const user = mockUser();
      const raffleIds = ['raffle-1', 'raffle-2', 'raffle-3'];
      const bulkResult = { success: 3, failed: 0, errors: [] };
      rafflesService.bulkCancelRaffles.mockResolvedValue(bulkResult);

      const result = await resolver.bulkCancelRaffles(user, raffleIds);

      expect(rafflesService.bulkCancelRaffles).toHaveBeenCalledWith(
        user.id,
        raffleIds,
      );
      expect(result).toEqual(bulkResult);
    });
  });

  describe('incrementRaffleViews', () => {
    it('should increment raffle view count', async () => {
      rafflesService.incrementViewCount.mockResolvedValue(undefined);

      const result = await resolver.incrementRaffleViews('raffle-1');

      expect(rafflesService.incrementViewCount).toHaveBeenCalledWith(
        'raffle-1',
      );
      expect(result).toBe(true);
    });
  });
});
