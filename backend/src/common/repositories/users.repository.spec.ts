import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from './users.repository';
import {
  User,
  UserRole,
  KycStatus,
  SellerPaymentAccountStatus,
} from '@prisma/client';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let mockPrismaService: any;

  // Create a mock user with only required fields
  const createMockUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-id-123',
      email: 'test@example.com',
      passwordHash: 'hashedPassword123',
      nombre: 'Test',
      apellido: 'User',
      role: UserRole.USER,
      kycStatus: KycStatus.NOT_SUBMITTED,
      sellerPaymentAccountStatus: SellerPaymentAccountStatus.NOT_CONNECTED,
      emailVerified: false,
      isDeleted: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      // Nullable fields
      googleId: null,
      sellerPaymentAccountId: null,
      avatarUrl: null,
      fechaNacimiento: null,
      documentType: null,
      documentNumber: null,
      documentFrontUrl: null,
      documentBackUrl: null,
      cuitCuil: null,
      street: null,
      streetNumber: null,
      apartment: null,
      city: null,
      province: null,
      postalCode: null,
      country: 'Argentina',
      defaultSenderAddressId: null,
      emailVerifiedAt: null,
      termsAcceptedAt: null,
      termsVersion: null,
      kycSubmittedAt: null,
      kycVerifiedAt: null,
      kycRejectedReason: null,
      phone: null,
      deletedAt: null,
      lastLoginAt: null,
      ...overrides,
    }) as User;

  const mockUser = createMockUser();

  const mockUserWithReputation = {
    ...mockUser,
    reputation: {
      id: 'rep-id-123',
      userId: mockUser.id,
      totalSales: 10,
      totalRaffles: 5,
      completedRaffles: 3,
      cancelledRaffles: 1,
      totalTicketsSold: 100,
      totalRevenue: 5000,
      rating: 4.5,
      reviewCount: 8,
      level: 'PLATA',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
  });

  describe('BaseRepository methods', () => {
    describe('findById', () => {
      it('should find user by ID', async () => {
        mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

        const result = await repository.findById('user-id-123');

        expect(result).toEqual(mockUser);
        expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-id-123' },
        });
      });

      it('should find user by ID with includes', async () => {
        mockPrismaService.user.findUnique.mockResolvedValue(
          mockUserWithReputation,
        );
        const include = { reputation: true };

        const result = await repository.findById('user-id-123', include);

        expect(result).toEqual(mockUserWithReputation);
        expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-id-123' },
          include,
        });
      });
    });

    describe('create', () => {
      it('should create a new user', async () => {
        mockPrismaService.user.create.mockResolvedValue(mockUser);
        const userData = {
          email: 'test@example.com',
          passwordHash: 'hashedPassword123',
          nombre: 'Test',
          apellido: 'User',
        };

        const result = await repository.create(userData as any);

        expect(result).toEqual(mockUser);
        expect(mockPrismaService.user.create).toHaveBeenCalledWith({
          data: userData,
        });
      });
    });

    describe('update', () => {
      it('should update user by ID', async () => {
        const updatedUser = createMockUser({ nombre: 'Updated' });
        mockPrismaService.user.update.mockResolvedValue(updatedUser);
        const updateData = { nombre: 'Updated' };

        const result = await repository.update('user-id-123', updateData);

        expect(result).toEqual(updatedUser);
        expect(mockPrismaService.user.update).toHaveBeenCalledWith({
          where: { id: 'user-id-123' },
          data: updateData,
        });
      });
    });

    describe('delete', () => {
      it('should delete user by ID', async () => {
        mockPrismaService.user.delete.mockResolvedValue(mockUser);

        const result = await repository.delete('user-id-123');

        expect(result).toEqual(mockUser);
        expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
          where: { id: 'user-id-123' },
        });
      });
    });

    describe('exists', () => {
      it('should return true if user exists', async () => {
        mockPrismaService.user.count.mockResolvedValue(1);

        const result = await repository.exists({ email: 'test@example.com' });

        expect(result).toBe(true);
        expect(mockPrismaService.user.count).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        });
      });

      it('should return false if user does not exist', async () => {
        mockPrismaService.user.count.mockResolvedValue(0);

        const result = await repository.exists({
          email: 'nonexistent@example.com',
        });

        expect(result).toBe(false);
      });
    });
  });

  describe('findByEmail', () => {
    it('should find user by email without includes', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should find user by email with includes', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(
        mockUserWithReputation,
      );
      const include = { reputation: true };

      const result = await repository.findByEmail('test@example.com', include);

      expect(result).toEqual(mockUserWithReputation);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include,
      });
    });

    it('should return null when email not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByGoogleId', () => {
    it('should find user by Google ID without includes', async () => {
      const googleUser = createMockUser({ googleId: 'google-123' });
      mockPrismaService.user.findUnique.mockResolvedValue(googleUser);

      const result = await repository.findByGoogleId('google-123');

      expect(result).toEqual(googleUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: 'google-123' },
      });
    });

    it('should find user by Google ID with includes', async () => {
      const googleUser = { ...mockUserWithReputation, googleId: 'google-123' };
      mockPrismaService.user.findUnique.mockResolvedValue(googleUser);
      const include = { reputation: true };

      const result = await repository.findByGoogleId('google-123', include);

      expect(result).toEqual(googleUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: 'google-123' },
        include,
      });
    });

    it('should return null when Google ID not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByGoogleId('nonexistent-google-id');

      expect(result).toBeNull();
    });
  });

  describe('findBySellerPaymentAccountId', () => {
    it('should find user by MP User ID without includes', async () => {
      const mpUser = createMockUser({ sellerPaymentAccountId: 'mp-123' });
      mockPrismaService.user.findUnique.mockResolvedValue(mpUser);

      const result = await repository.findBySellerPaymentAccountId('mp-123');

      expect(result).toEqual(mpUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { sellerPaymentAccountId: 'mp-123' },
      });
    });

    it('should find user by MP User ID with includes', async () => {
      const mpUser = {
        ...mockUserWithReputation,
        sellerPaymentAccountId: 'mp-123',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mpUser);
      const include = { reputation: true };

      const result = await repository.findBySellerPaymentAccountId(
        'mp-123',
        include,
      );

      expect(result).toEqual(mpUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { sellerPaymentAccountId: 'mp-123' },
        include,
      });
    });

    it('should return null when MP User ID not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result =
        await repository.findBySellerPaymentAccountId('nonexistent-mp-id');

      expect(result).toBeNull();
    });
  });

  describe('updateSellerPaymentAccountCredentials', () => {
    it('should update seller payment account status successfully', async () => {
      const connectedUser = createMockUser({
        sellerPaymentAccountId: 'spa-123',
        sellerPaymentAccountStatus: SellerPaymentAccountStatus.CONNECTED,
      });
      mockPrismaService.user.update.mockResolvedValue(connectedUser);

      const accountData = {
        sellerPaymentAccountId: 'spa-123',
        sellerPaymentAccountStatus: SellerPaymentAccountStatus.CONNECTED,
      };

      const result = await repository.updateSellerPaymentAccountCredentials(
        'user-id-123',
        accountData,
      );

      expect(result).toEqual(connectedUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
        data: accountData,
      });
    });

    it('should handle PENDING status', async () => {
      const pendingUser = createMockUser({
        sellerPaymentAccountId: 'spa-123',
        sellerPaymentAccountStatus: SellerPaymentAccountStatus.PENDING,
      });
      mockPrismaService.user.update.mockResolvedValue(pendingUser);

      const accountData = {
        sellerPaymentAccountId: 'spa-123',
        sellerPaymentAccountStatus: SellerPaymentAccountStatus.PENDING,
      };

      const result = await repository.updateSellerPaymentAccountCredentials(
        'user-id-123',
        accountData,
      );

      expect(result.sellerPaymentAccountStatus).toBe(
        SellerPaymentAccountStatus.PENDING,
      );
    });
  });

  describe('disconnectSellerPaymentAccount', () => {
    it('should disconnect seller payment account and clear summary fields', async () => {
      const disconnectedUser = createMockUser({
        sellerPaymentAccountId: null,
        sellerPaymentAccountStatus: SellerPaymentAccountStatus.NOT_CONNECTED,
      });
      mockPrismaService.user.update.mockResolvedValue(disconnectedUser);

      const result =
        await repository.disconnectSellerPaymentAccount('user-id-123');

      expect(result).toEqual(disconnectedUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
        data: {
          sellerPaymentAccountId: null,
          sellerPaymentAccountStatus: 'NOT_CONNECTED',
        },
      });
    });

    it('should set seller payment account id to null', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await repository.disconnectSellerPaymentAccount('user-id-123');

      const updateCall = mockPrismaService.user.update.mock.calls[0];
      expect(updateCall[0].data.sellerPaymentAccountId).toBeNull();
    });
  });

  describe('findWithReputation', () => {
    it('should find user with reputation data', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(
        mockUserWithReputation,
      );

      const result = await repository.findWithReputation('user-id-123');

      expect(result).toEqual(mockUserWithReputation);
      expect(result?.reputation).toBeDefined();
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
        include: { reputation: true },
      });
    });

    it('should return null when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await repository.findWithReputation('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should handle user without reputation', async () => {
      const userWithoutReputation = { ...mockUser, reputation: null };
      mockPrismaService.user.findUnique.mockResolvedValue(
        userWithoutReputation,
      );

      const result = await repository.findWithReputation('user-id-123');

      expect(result?.reputation).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should soft delete user by setting isDeleted and deletedAt', async () => {
      const deletedUser = createMockUser({
        isDeleted: true,
        deletedAt: new Date(),
      });
      mockPrismaService.user.update.mockResolvedValue(deletedUser);

      const result = await repository.softDelete('user-id-123');

      expect(result.isDeleted).toBe(true);
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-123' },
        data: {
          isDeleted: true,
          deletedAt: expect.any(Date),
        },
      });
    });

    it('should not hard delete the user', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await repository.softDelete('user-id-123');

      expect(mockPrismaService.user.delete).not.toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });

  describe('findByRole', () => {
    it('should find users by USER role', async () => {
      const users = [mockUser, createMockUser({ id: 'user-id-456' })];
      mockPrismaService.user.findMany.mockResolvedValue(users);

      const result = await repository.findByRole(UserRole.USER);

      expect(result).toEqual(users);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.USER,
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should find users by ADMIN role', async () => {
      const adminUser = createMockUser({ role: UserRole.ADMIN });
      mockPrismaService.user.findMany.mockResolvedValue([adminUser]);

      const result = await repository.findByRole(UserRole.ADMIN);

      expect(result[0].role).toBe(UserRole.ADMIN);
    });

    it('should filter out deleted users by default', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);

      await repository.findByRole(UserRole.USER);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.USER,
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should include deleted users when specified', async () => {
      const deletedUser = createMockUser({
        isDeleted: true,
        deletedAt: new Date(),
      });
      mockPrismaService.user.findMany.mockResolvedValue([deletedUser]);

      const result = await repository.findByRole(UserRole.USER, {
        includeDeleted: true,
      });

      expect(result[0].isDeleted).toBe(true);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.USER,
          isDeleted: undefined,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle pagination options', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);

      await repository.findByRole(UserRole.USER, { skip: 10, take: 5 });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          role: UserRole.USER,
          isDeleted: false,
        },
        skip: 10,
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should order by createdAt desc', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([mockUser]);

      await repository.findByRole(UserRole.USER);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
