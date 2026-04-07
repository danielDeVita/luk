import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole, KycStatus, DocumentType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ReputationService } from './reputation.service';

jest.mock('bcrypt');

type MockPrismaService = {
  user: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  raffle: {
    count: jest.Mock;
    findUnique: jest.Mock;
  };
  review: {
    create: jest.Mock;
  };
  ticket: {
    count: jest.Mock;
  };
  userReputation: {
    findUnique: jest.Mock;
    create: jest.Mock;
  };
};

type MockEncryptionService = {
  decryptUserPII: jest.Mock;
  encryptUserPII: jest.Mock;
};

type MockNotificationsService = {
  sendAdminNewKycSubmission: jest.Mock;
  sendSellerReviewReceivedNotification: jest.Mock;
  create: jest.Mock;
};

type MockReputationService = {
  recalculateSellerReputation: jest.Mock;
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrismaService;
  let encryptionService: MockEncryptionService;
  let _notificationsService: MockNotificationsService;
  let reputationService: MockReputationService;

  const mockPrismaService = (): MockPrismaService => ({
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    raffle: {
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    review: {
      create: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
    },
    userReputation: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  });

  const mockEncryptionService = (): MockEncryptionService => ({
    decryptUserPII: jest.fn(),
    encryptUserPII: jest.fn(),
  });

  const mockNotificationsService = (): MockNotificationsService => ({
    sendAdminNewKycSubmission: jest.fn(),
    sendSellerReviewReceivedNotification: jest.fn().mockResolvedValue(true),
    create: jest.fn(),
  });

  const mockReputationService = (): MockReputationService => ({
    recalculateSellerReputation: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: EncryptionService, useValue: mockEncryptionService() },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService(),
        },
        { provide: ReputationService, useValue: mockReputationService() },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    encryptionService = module.get(
      EncryptionService,
    ) as unknown as MockEncryptionService;
    _notificationsService = module.get(
      NotificationsService,
    ) as unknown as MockNotificationsService;
    reputationService = module.get(
      ReputationService,
    ) as unknown as MockReputationService;
    prisma.user.findMany.mockResolvedValue([]);
  });

  describe('findOne', () => {
    it('should find user by ID with includes', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        nombre: 'Juan',
        apellido: 'Pérez',
        rafflesCreated: [],
        ticketsPurchased: [],
        reputation: { userId: 'user-1' },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1', isDeleted: false },
        include: {
          rafflesCreated: { include: { product: true } },
          ticketsPurchased: { include: { raffle: true } },
          reputation: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('getUserWithDecryptedPII', () => {
    it('should decrypt and return user PII', async () => {
      const mockUser = {
        id: 'user-1',
        documentNumber: 'encrypted-dni',
        cuitCuil: 'encrypted-cuit',
      };
      const decryptedPII = {
        documentNumber: '12345678',
        cuitCuil: '20-12345678-9',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      encryptionService.decryptUserPII.mockReturnValue(decryptedPII);

      const result = await service.getUserWithDecryptedPII('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(encryptionService.decryptUserPII).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({ ...mockUser, ...decryptedPII });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getUserWithDecryptedPII('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const input = { nombre: 'Juan', apellido: 'Pérez', phone: '123456789' };

      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        ...input,
      });

      const result = await service.updateProfile('user-1', input);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: input,
      });
      expect(result).toBeDefined();
    });
  });

  describe('updateKyc', () => {
    it('should encrypt PII and update KYC status to PENDING_REVIEW', async () => {
      const input = {
        documentType: DocumentType.DNI,
        documentNumber: '12345678',
        documentFrontUrl: 'https://example.com/front.jpg',
        documentBackUrl: 'https://example.com/back.jpg',
        cuitCuil: '20-12345678-9',
        street: 'Av. Corrientes',
        streetNumber: '1234',
        apartment: '5B',
        city: 'CABA',
        province: 'Buenos Aires',
        postalCode: '1043',
        phone: '123456789',
      };

      const encryptedPII = {
        documentNumber: 'encrypted-dni',
        cuitCuil: 'encrypted-cuit',
        street: 'encrypted-street',
        streetNumber: 'encrypted-number',
        apartment: 'encrypted-apt',
        city: 'encrypted-city',
        province: 'encrypted-province',
        postalCode: 'encrypted-postal',
        phone: 'encrypted-phone',
      };

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        kycStatus: KycStatus.NOT_SUBMITTED,
      });
      encryptionService.encryptUserPII.mockReturnValue(encryptedPII);
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        kycStatus: KycStatus.PENDING_REVIEW,
      });

      const result = await service.updateKyc('user-1', input);

      expect(encryptionService.encryptUserPII).toHaveBeenCalledWith({
        documentNumber: input.documentNumber,
        cuitCuil: input.cuitCuil,
        street: input.street,
        streetNumber: input.streetNumber,
        apartment: input.apartment,
        city: input.city,
        province: input.province,
        postalCode: input.postalCode,
        phone: input.phone,
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          kycStatus: KycStatus.PENDING_REVIEW,
          documentNumber: encryptedPII.documentNumber,
          cuitCuil: encryptedPII.cuitCuil,
        }),
      });
      expect(result.kycStatus).toBe(KycStatus.PENDING_REVIEW);
    });

    it('should throw BadRequestException if KYC already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        kycStatus: KycStatus.VERIFIED,
      });

      const input = {
        documentType: DocumentType.DNI,
        documentNumber: '12345678',
        documentFrontUrl: 'https://example.com/front.jpg',
        documentBackUrl: 'https://example.com/back.jpg',
        cuitCuil: '20-12345678-9',
        street: 'Av. Corrientes',
        streetNumber: '1234',
        city: 'CABA',
        province: 'Buenos Aires',
        postalCode: '1043',
        phone: '123456789',
      };

      await expect(service.updateKyc('user-1', input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const input = {
        documentType: DocumentType.DNI,
        documentNumber: '12345678',
        documentFrontUrl: 'https://example.com/front.jpg',
        documentBackUrl: 'https://example.com/back.jpg',
        cuitCuil: '20-12345678-9',
        street: 'Av. Corrientes',
        streetNumber: '1234',
        city: 'CABA',
        province: 'Buenos Aires',
        postalCode: '1043',
        phone: '123456789',
      };

      await expect(service.updateKyc('invalid-id', input)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('acceptTerms', () => {
    it('should update terms acceptance', async () => {
      const input = { termsVersion: '1.0' };

      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        termsAcceptedAt: expect.any(Date),
        termsVersion: '1.0',
      });

      const result = await service.acceptTerms('user-1', input);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          termsAcceptedAt: expect.any(Date),
          termsVersion: '1.0',
        },
      });
      expect(result).toBeDefined();
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin user', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });

      const result = await service.isAdmin('admin-1');

      expect(result).toBe(true);
    });

    it('should return false for non-admin user', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: UserRole.USER });

      const result = await service.isAdmin('user-1');

      expect(result).toBe(false);
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      prisma.raffle.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
      prisma.ticket.count.mockResolvedValue(10);

      const result = await service.getUserStats('user-1');

      expect(prisma.raffle.count).toHaveBeenCalledWith({
        where: { sellerId: 'user-1' },
      });
      expect(prisma.ticket.count).toHaveBeenCalledWith({
        where: { buyerId: 'user-1', estado: 'PAGADO' },
      });
      expect(result).toEqual({
        rafflesCreated: 5,
        ticketsPurchased: 10,
        rafflesWon: 2,
      });
    });
  });

  describe('softDelete', () => {
    it('should mark user as deleted', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        isDeleted: true,
        deletedAt: expect.any(Date),
      });

      const result = await service.softDelete('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isDeleted: true, deletedAt: expect.any(Date) },
      });
      expect(result.isDeleted).toBe(true);
    });
  });

  describe('banUser', () => {
    it('should set user role to BANNED', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        role: UserRole.BANNED,
      });

      const result = await service.banUser('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.BANNED },
      });
      expect(result.role).toBe(UserRole.BANNED);
    });
  });

  describe('unbanUser', () => {
    it('should set user role to USER', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        role: UserRole.USER,
      });

      const result = await service.unbanUser('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.USER },
      });
      expect(result.role).toBe(UserRole.USER);
    });
  });

  describe('changePassword', () => {
    it('should validate old password and update to new hashed password', async () => {
      const mockUser = {
        id: 'user-1',
        passwordHash: 'hashed-old-password',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'hashed-new-password',
      });

      const result = await service.changePassword(
        'user-1',
        'oldPassword123',
        'newPassword456',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'oldPassword123',
        'hashed-old-password',
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword456', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'hashed-new-password' },
      });
      expect(result).toBeDefined();
    });

    it('should throw error if old password is incorrect', async () => {
      const mockUser = {
        id: 'user-1',
        passwordHash: 'hashed-old-password',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrongPassword', 'newPassword456'),
      ).rejects.toThrow('La contraseña actual es incorrecta');
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('invalid-id', 'oldPass', 'newPass'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSellerProfile', () => {
    it('should return seller public profile with reputation', async () => {
      const mockUser = {
        id: 'seller-1',
        nombre: 'Juan',
        apellido: 'Vendedor',
        createdAt: new Date(),
        kycStatus: KycStatus.VERIFIED,
        rafflesCreated: [{ id: 'raffle-1', titulo: 'Rifa 1', product: {} }],
        reputation: {
          userId: 'seller-1',
          ratingPromedioVendedor: 4.5,
          totalVentasCompletadas: 10,
          nivelVendedor: 'BRONCE',
        },
        reviewsReceived: [
          {
            id: 'review-1',
            rating: 5,
            comentario: 'Excelente vendedor',
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
            reviewer: { nombre: 'Ana', apellido: 'Buyer' },
            raffle: { titulo: 'Rifa 1' },
          },
        ],
        _count: { reviewsReceived: 1 },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getSellerProfile('seller-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'seller-1' },
        include: {
          rafflesCreated: {
            where: { isHidden: false },
            include: { product: true },
            orderBy: { createdAt: 'desc' },
          },
          reputation: true,
          reviewsReceived: {
            where: { commentHidden: false },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              reviewer: { select: { nombre: true, apellido: true } },
              raffle: { select: { titulo: true } },
            },
          },
          _count: { select: { reviewsReceived: true } },
        },
      });
      expect(result).toEqual({
        id: 'seller-1',
        nombre: 'Juan',
        apellido: 'Vendedor',
        createdAt: mockUser.createdAt,
        raffles: mockUser.rafflesCreated,
        reputation: 4.5,
        totalVentas: 10,
        nivelVendedor: 'BRONCE',
        isVerified: true,
        reviewCount: 1,
        reviews: [
          {
            id: 'review-1',
            rating: 5,
            comentario: 'Excelente vendedor',
            createdAt: mockUser.reviewsReceived[0].createdAt,
            reviewerName: 'Ana Buyer',
            raffleTitle: 'Rifa 1',
          },
        ],
      });
    });

    it('should create reputation if it does not exist', async () => {
      const mockUser = {
        id: 'seller-1',
        nombre: 'Juan',
        apellido: 'Vendedor',
        createdAt: new Date(),
        kycStatus: KycStatus.VERIFIED,
        rafflesCreated: [],
        reputation: null,
        reviewsReceived: [],
        _count: { reviewsReceived: 0 },
      };

      const newReputation = {
        userId: 'seller-1',
        ratingPromedioVendedor: 0,
        totalVentasCompletadas: 0,
        nivelVendedor: 'NUEVO',
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userReputation.findUnique.mockResolvedValue(null);
      prisma.userReputation.create.mockResolvedValue(newReputation);

      const result = await service.getSellerProfile('seller-1');

      expect(prisma.userReputation.create).toHaveBeenCalledWith({
        data: { userId: 'seller-1' },
      });
      expect(result.reputation).toBe(null);
      expect(result.nivelVendedor).toBe('NUEVO');
      expect(result.reviewCount).toBe(0);
      expect(result.reviews).toEqual([]);
    });

    it('should throw NotFoundException if seller not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getSellerProfile('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createSellerReview', () => {
    const confirmedRaffle = {
      id: 'raffle-1',
      sellerId: 'seller-1',
      winnerId: 'winner-1',
      deliveryStatus: 'CONFIRMED',
      review: null,
      seller: {
        id: 'seller-1',
        email: 'seller@test.com',
        nombre: 'Seller',
        apellido: 'Pro',
      },
    };

    it('should let the confirmed winner review the seller', async () => {
      const review = {
        id: 'review-1',
        rating: 5,
        comentario: 'Excelente entrega',
        createdAt: new Date('2026-04-01T12:00:00.000Z'),
        reviewer: { nombre: 'Winner', apellido: 'Buyer' },
        raffle: { titulo: 'MacBook QA' },
      };

      prisma.raffle.findUnique.mockResolvedValue(confirmedRaffle);
      prisma.review.create.mockResolvedValue(review);

      const result = await service.createSellerReview('winner-1', {
        raffleId: 'raffle-1',
        rating: 5,
        comentario: ' Excelente entrega ',
      });

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          raffleId: 'raffle-1',
          reviewerId: 'winner-1',
          sellerId: 'seller-1',
          rating: 5,
          comentario: 'Excelente entrega',
        },
        include: {
          reviewer: { select: { nombre: true, apellido: true } },
          raffle: { select: { titulo: true } },
        },
      });
      expect(result).toEqual({
        id: 'review-1',
        rating: 5,
        comentario: 'Excelente entrega',
        createdAt: review.createdAt,
        reviewerName: 'Winner Buyer',
        raffleTitle: 'MacBook QA',
      });
      expect(
        reputationService.recalculateSellerReputation,
      ).toHaveBeenCalledWith('seller-1');
    });

    it('should reject reviews from users who did not win the raffle', async () => {
      prisma.raffle.findUnique.mockResolvedValue(confirmedRaffle);

      await expect(
        service.createSellerReview('other-user', {
          raffleId: 'raffle-1',
          rating: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject reviews before delivery is confirmed', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        ...confirmedRaffle,
        deliveryStatus: 'IN_TRANSIT',
      });

      await expect(
        service.createSellerReview('winner-1', {
          raffleId: 'raffle-1',
          rating: 4,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate reviews for the same raffle', async () => {
      prisma.raffle.findUnique.mockResolvedValue({
        ...confirmedRaffle,
        review: { id: 'existing-review' },
      });

      await expect(
        service.createSellerReview('winner-1', {
          raffleId: 'raffle-1',
          rating: 4,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject ratings outside the valid range', async () => {
      await expect(
        service.createSellerReview('winner-1', {
          raffleId: 'raffle-1',
          rating: 6,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.raffle.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('ensureReputation', () => {
    it('should return existing reputation', async () => {
      const mockReputation = {
        userId: 'user-1',
        ratingPromedioVendedor: 4.5,
      };

      prisma.userReputation.findUnique.mockResolvedValue(mockReputation);

      const result = await service.ensureReputation('user-1');

      expect(prisma.userReputation.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual(mockReputation);
    });

    it('should create new reputation if it does not exist', async () => {
      const newReputation = {
        userId: 'user-1',
        ratingPromedioVendedor: 0,
      };

      prisma.userReputation.findUnique.mockResolvedValue(null);
      prisma.userReputation.create.mockResolvedValue(newReputation);

      const result = await service.ensureReputation('user-1');

      expect(prisma.userReputation.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
      expect(result).toEqual(newReputation);
    });
  });

  describe('updateAvatar', () => {
    it('should update user avatar URL', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      const result = await service.updateAvatar(
        'user-1',
        'https://example.com/avatar.jpg',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: 'https://example.com/avatar.jpg' },
      });
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('deleteAvatar', () => {
    it('should set avatar to null', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        avatarUrl: null,
      });

      const result = await service.deleteAvatar('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: null },
      });
      expect(result.avatarUrl).toBeNull();
    });
  });
});
