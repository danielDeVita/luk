import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// Type for our mock PrismaService
type MockPrismaService = {
  paymentProviderEvent: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    count: jest.Mock;
  };
  transaction: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
  ticket: {
    findMany: jest.Mock;
    aggregate: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };
  raffle: {
    count: jest.Mock;
  };
  dispute: {
    count: jest.Mock;
  };
  review: {
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  activityLog: {
    findMany: jest.Mock;
  };
};

type MockEncryptionService = {
  decryptUserPII: jest.Mock;
};

describe('AdminService', () => {
  let service: AdminService;
  let prisma: MockPrismaService;
  let encryptionService: MockEncryptionService;

  const mockPrismaService = (): MockPrismaService => ({
    paymentProviderEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    ticket: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    raffle: {
      count: jest.fn(),
    },
    dispute: {
      count: jest.fn(),
    },
    review: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    activityLog: {
      findMany: jest.fn(),
    },
  });

  const mockEncryptionService: MockEncryptionService = {
    decryptUserPII: jest.fn(() => ({
      documentNumber: 'DECRYPTED_DOC',
      street: 'Decrypted Street',
      streetNumber: '123',
      apartment: '4B',
      city: 'Buenos Aires',
      province: 'CABA',
      postalCode: '1234',
      phone: '+541234567890',
      cuitCuil: '20-12345678-9',
    })),
  };

  const mockNotificationsService = {
    sendKycApprovedNotification: jest.fn().mockResolvedValue(true),
    sendKycRejectedNotification: jest.fn().mockResolvedValue(true),
    create: jest.fn().mockResolvedValue({}),
  };

  const createTestUser = (overrides = {}) => ({
    id: 'user-1',
    email: 'test@example.com',
    nombre: 'Test',
    apellido: 'User',
    role: UserRole.USER,
    sellerPaymentAccountStatus: 'NOT_CONNECTED',
    kycStatus: 'NOT_SUBMITTED',
    createdAt: new Date(),
    isDeleted: false,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    encryptionService = module.get(
      EncryptionService,
    ) as unknown as MockEncryptionService;
  });

  describe('getPaymentProviderEvents', () => {
    it('should return filtered payment provider events with total count', async () => {
      const events = [
        { eventId: 'evt-1', eventType: 'payment', processedAt: new Date() },
        { eventId: 'evt-2', eventType: 'payment', processedAt: new Date() },
      ];

      prisma.paymentProviderEvent.findMany.mockResolvedValue(events);
      prisma.paymentProviderEvent.count.mockResolvedValue(2);

      const result = await service.getPaymentProviderEvents({
        limit: 50,
        offset: 0,
      });

      expect(result).toEqual({ events, total: 2 });
      expect(prisma.paymentProviderEvent.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { processedAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by event type', async () => {
      prisma.paymentProviderEvent.findMany.mockResolvedValue([]);
      prisma.paymentProviderEvent.count.mockResolvedValue(0);

      await service.getPaymentProviderEvents({ eventType: 'payment' });

      expect(prisma.paymentProviderEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventType: { contains: 'payment' } },
        }),
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      prisma.paymentProviderEvent.findMany.mockResolvedValue([]);
      prisma.paymentProviderEvent.count.mockResolvedValue(0);

      await service.getPaymentProviderEvents({ startDate, endDate });

      expect(prisma.paymentProviderEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            processedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      );
    });
  });

  describe('getPaymentProviderEventById', () => {
    it('should return event by ID', async () => {
      const event = { eventId: 'evt-1', eventType: 'payment' };
      prisma.paymentProviderEvent.findUnique.mockResolvedValue(event);

      const result = await service.getPaymentProviderEventById('evt-1');

      expect(result).toEqual(event);
      expect(prisma.paymentProviderEvent.findUnique).toHaveBeenCalledWith({
        where: { eventId: 'evt-1' },
      });
    });
  });

  describe('getTransactions', () => {
    it('should return filtered transactions', async () => {
      const transactions = [
        {
          id: 'tx-1',
          userId: 'user-1',
          raffleId: 'raffle-1',
          user: { id: 'user-1', email: 'user@test.com' },
          raffle: { id: 'raffle-1', titulo: 'Test Raffle' },
        },
      ];

      prisma.transaction.findMany.mockResolvedValue(transactions);
      prisma.transaction.count.mockResolvedValue(1);

      const result = await service.getTransactions({});

      expect(result).toEqual({ transactions, total: 1 });
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false },
        }),
      );
    });

    it('should filter by userId', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.getTransactions({ userId: 'user-1' });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('should filter by providerPaymentId', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.getTransactions({ providerPaymentId: 'mp-123' });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ providerPaymentId: 'mp-123' }),
        }),
      );
    });
  });

  describe('getPaymentDebugInfo', () => {
    it('should return comprehensive payment debug information', async () => {
      const paymentProviderEvent = {
        eventId: 'mp-123',
        eventType: 'payment.updated',
        processedAt: new Date(),
      };
      const transaction = {
        id: 'tx-1',
        providerPaymentId: 'mp-123',
        estado: 'COMPLETADO',
        monto: 500,
        user: { id: 'user-1', email: 'buyer@test.com', nombre: 'Buyer' },
        raffle: { id: 'raffle-1', titulo: 'Test Raffle', sellerId: 'seller-1' },
      };
      prisma.paymentProviderEvent.findFirst.mockResolvedValue(
        paymentProviderEvent,
      );
      prisma.transaction.findFirst.mockResolvedValue(transaction);

      const result = await service.getPaymentDebugInfo('mp-123');

      expect(result).toEqual({
        providerPaymentId: 'mp-123',
        webhookReceived: true,
        webhookProcessedAt: paymentProviderEvent.processedAt,
        webhookEventType: 'payment.updated',
        transactionCreated: true,
        transactionId: 'tx-1',
        transactionStatus: 'COMPLETADO',
        transactionAmount: 500,
        ticketsCount: 0,
        tickets: [],
        raffle: transaction.raffle,
        buyer: transaction.user,
      });
    });

    it('should handle missing webhook event', async () => {
      prisma.paymentProviderEvent.findFirst.mockResolvedValue(null);
      prisma.transaction.findFirst.mockResolvedValue(null);
      prisma.ticket.findMany.mockResolvedValue([]);

      const result = await service.getPaymentDebugInfo('mp-123');

      expect(result.webhookReceived).toBe(false);
      expect(result.transactionCreated).toBe(false);
      expect(result.ticketsCount).toBe(0);
    });
  });

  describe('getAdminStats', () => {
    it('should return comprehensive admin statistics', async () => {
      const ticketStats = {
        _count: { id: 1000 },
        _sum: { precioPagado: 50000 },
      };

      prisma.user.count
        .mockResolvedValueOnce(500) // total users
        .mockResolvedValueOnce(20); // new users today
      prisma.raffle.count
        .mockResolvedValueOnce(100) // total raffles
        .mockResolvedValueOnce(25) // active raffles
        .mockResolvedValueOnce(50) // completed raffles
        .mockResolvedValueOnce(5); // new raffles today
      prisma.transaction.count.mockResolvedValue(800);
      prisma.dispute.count
        .mockResolvedValueOnce(10) // total disputes
        .mockResolvedValueOnce(3); // pending disputes
      prisma.paymentProviderEvent.count.mockResolvedValue(150);
      prisma.ticket.aggregate.mockResolvedValue(ticketStats);

      const result = await service.getAdminStats();

      expect(result).toEqual({
        totalUsers: 500,
        totalRaffles: 100,
        activeRaffles: 25,
        completedRaffles: 50,
        totalTransactions: 800,
        totalRevenue: 50000,
        totalTicketsSold: 1000,
        totalDisputes: 10,
        pendingDisputes: 3,
        recentPaymentEvents: 150,
        newUsersToday: 20,
        newRafflesToday: 5,
      });
    });

    it('should handle zero revenue gracefully', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.raffle.count.mockResolvedValue(0);
      prisma.transaction.count.mockResolvedValue(0);
      prisma.dispute.count.mockResolvedValue(0);
      prisma.paymentProviderEvent.count.mockResolvedValue(0);
      prisma.ticket.aggregate.mockResolvedValue({
        _count: { id: 0 },
        _sum: { precioPagado: null },
      });

      const result = await service.getAdminStats();

      expect(result.totalRevenue).toBe(0);
      expect(result.totalTicketsSold).toBe(0);
    });
  });

  describe('getUsers', () => {
    it('should return paginated users list', async () => {
      const users = [
        {
          ...createTestUser(),
          _count: { rafflesCreated: 5, ticketsPurchased: 10, rafflesWon: 1 },
          reputation: null,
        },
      ];

      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({});

      expect(result.total).toBe(1);
      expect(result.users[0]).toEqual(
        expect.objectContaining({
          id: 'user-1',
          email: 'test@example.com',
          rafflesCreated: 5,
          ticketsPurchased: 10,
          rafflesWon: 1,
        }),
      );
    });

    it('should include internal buyer metrics and risk flags', async () => {
      const recentDate = new Date();
      const users = [
        {
          ...createTestUser({ createdAt: recentDate }),
          _count: { rafflesCreated: 1, ticketsPurchased: 12, rafflesWon: 0 },
          reputation: {
            totalTicketsComprados: 60,
            totalRifasGanadas: 1,
            totalComprasCompletadas: 2,
            disputasComoCompradorAbiertas: 2,
          },
        },
      ];

      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({});

      expect(result.users[0]).toEqual(
        expect.objectContaining({
          totalTicketsComprados: 60,
          totalRifasGanadas: 1,
          totalComprasCompletadas: 2,
          disputasComoCompradorAbiertas: 2,
          buyerRiskFlags: expect.arrayContaining([
            'HIGH_DISPUTE_RATE',
            'NEW_WITH_DISPUTE',
            'HEAVY_BUYER',
          ]),
        }),
      );
    });

    it('should filter by role', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({ role: UserRole.ADMIN });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: UserRole.ADMIN, isDeleted: false },
        }),
      );
    });

    it('should search by email, name, or apellido', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({ search: 'john' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isDeleted: false,
            OR: [
              { email: { contains: 'john', mode: 'insensitive' } },
              { nombre: { contains: 'john', mode: 'insensitive' } },
              { apellido: { contains: 'john', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should exclude deleted users by default', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false },
        }),
      );
    });

    it('should include deleted users when specified', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({ includeDeleted: true });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('getUserById', () => {
    it('should return user details with reputation', async () => {
      const user = {
        ...createTestUser(),
        reputation: { nivel: 'BRONCE', totalVentas: 10 },
        _count: { rafflesCreated: 5, ticketsPurchased: 10, rafflesWon: 1 },
      };

      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserById('user-1');

      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('user-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getUserById('user-1')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('getReviews', () => {
    it('should return visible reviews with public comments', async () => {
      const review = {
        id: 'review-1',
        rating: 5,
        comentario: 'Excelente vendedor',
        createdAt: new Date('2026-04-01T12:00:00.000Z'),
        commentHidden: false,
        commentHiddenReason: null,
        seller: {
          nombre: 'Seller',
          apellido: 'Pro',
          email: 'seller@test.com',
        },
        reviewer: {
          nombre: 'Buyer',
          apellido: 'Winner',
          email: 'buyer@test.com',
        },
        raffle: { titulo: 'MacBook QA' },
      };

      prisma.review.findMany.mockResolvedValue([review]);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getReviews({});

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { commentHidden: false },
        }),
      );
      expect(result).toEqual({
        reviews: [
          expect.objectContaining({
            id: 'review-1',
            comentario: 'Excelente vendedor',
            reviewerName: 'Buyer Winner',
            sellerName: 'Seller Pro',
            raffleTitle: 'MacBook QA',
            commentHidden: false,
          }),
        ],
        total: 1,
      });
    });

    it('should hide moderated comments in admin review mapping', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'review-1',
          rating: 2,
          comentario: 'Comentario ofensivo',
          createdAt: new Date('2026-04-01T12:00:00.000Z'),
          commentHidden: true,
          commentHiddenReason: 'Contenido ofensivo',
          seller: {
            nombre: 'Seller',
            apellido: 'Pro',
            email: 'seller@test.com',
          },
          reviewer: {
            nombre: 'Buyer',
            apellido: 'Winner',
            email: 'buyer@test.com',
          },
          raffle: { titulo: 'MacBook QA' },
        },
      ]);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getReviews({ includeHidden: true });

      expect(result.reviews[0]).toEqual(
        expect.objectContaining({
          comentario: null,
          commentHidden: true,
          commentHiddenReason: 'Contenido ofensivo',
        }),
      );
    });
  });

  describe('hideReviewComment', () => {
    it('should hide the review comment while keeping the review available', async () => {
      const updatedReview = {
        id: 'review-1',
        rating: 4,
        comentario: 'Texto original',
        createdAt: new Date('2026-04-01T12:00:00.000Z'),
        commentHidden: true,
        commentHiddenReason: 'Motivo de moderación',
        seller: {
          nombre: 'Seller',
          apellido: 'Pro',
          email: 'seller@test.com',
        },
        reviewer: {
          nombre: 'Buyer',
          apellido: 'Winner',
          email: 'buyer@test.com',
        },
        raffle: { titulo: 'MacBook QA' },
      };

      prisma.review.findUnique.mockResolvedValue({ id: 'review-1' });
      prisma.review.update.mockResolvedValue(updatedReview);

      const result = await service.hideReviewComment(
        'review-1',
        'admin-1',
        ' Motivo de moderación ',
      );

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          commentHidden: true,
          commentHiddenReason: 'Motivo de moderación',
          commentHiddenAt: expect.any(Date),
          commentHiddenById: 'admin-1',
        },
        include: {
          seller: { select: { nombre: true, apellido: true, email: true } },
          reviewer: { select: { nombre: true, apellido: true, email: true } },
          raffle: { select: { titulo: true } },
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          comentario: null,
          commentHidden: true,
          rating: 4,
        }),
      );
    });

    it('should reject moderation when review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.hideReviewComment('missing-review', 'admin-1', 'Motivo válido'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('banUser', () => {
    it('should ban a user successfully', async () => {
      const user = createTestUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({
        ...user,
        role: UserRole.BANNED,
      });

      const result = await service.banUser('user-1');

      expect(result.role).toBe(UserRole.BANNED);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.BANNED },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.banUser('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if trying to ban an admin', async () => {
      const admin = createTestUser({ role: UserRole.ADMIN });
      prisma.user.findUnique.mockResolvedValue(admin);

      await expect(service.banUser('admin-1')).rejects.toThrow(
        'Cannot ban an admin',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('unbanUser', () => {
    it('should unban a user successfully', async () => {
      const user = createTestUser({ role: UserRole.BANNED });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({
        ...user,
        role: UserRole.USER,
      });

      const result = await service.unbanUser('user-1');

      expect(result.role).toBe(UserRole.USER);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: UserRole.USER },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.unbanUser('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserActivity', () => {
    it('should return user activity logs', async () => {
      const user = createTestUser();
      const activityLogs = [
        {
          id: 'log-1',
          userId: 'user-1',
          action: 'LOGIN',
          createdAt: new Date(),
        },
        {
          id: 'log-2',
          userId: 'user-1',
          action: 'PURCHASE',
          createdAt: new Date(),
        },
      ];

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.activityLog.findMany.mockResolvedValue(activityLogs);

      const result = await service.getUserActivity('user-1', 50, 0);

      expect(result).toEqual(activityLogs);
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserActivity('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPendingKycSubmissions', () => {
    it('should return pending KYC submissions with decrypted PII', async () => {
      const users = [
        {
          id: 'user-1',
          email: 'user@test.com',
          nombre: 'Test',
          apellido: 'User',
          kycStatus: 'PENDING_REVIEW',
          documentType: 'DNI',
          documentNumber: 'ENCRYPTED_DOC',
          street: 'ENCRYPTED_STREET',
          streetNumber: 'ENCRYPTED_NUMBER',
          apartment: 'ENCRYPTED_APT',
          city: 'ENCRYPTED_CITY',
          province: 'ENCRYPTED_PROVINCE',
          postalCode: 'ENCRYPTED_POSTAL',
          phone: 'ENCRYPTED_PHONE',
          cuitCuil: 'ENCRYPTED_CUIT',
          kycSubmittedAt: new Date(),
          kycVerifiedAt: null,
          kycRejectedReason: null,
          createdAt: new Date(),
        },
      ];

      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getPendingKycSubmissions(50, 0);

      expect(result.submissions).toHaveLength(1);
      expect(result.submissions[0]).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          documentNumber: 'DECRYPTED_DOC',
          street: 'Decrypted Street',
          cuitCuil: '20-12345678-9',
        }),
      );
      expect(encryptionService.decryptUserPII).toHaveBeenCalledWith(users[0]);
    });

    it('should only fetch PENDING_REVIEW submissions', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getPendingKycSubmissions();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kycStatus: 'PENDING_REVIEW', isDeleted: false },
        }),
      );
    });
  });

  describe('approveKyc', () => {
    it('should approve pending KYC submission', async () => {
      const user = createTestUser({ kycStatus: 'PENDING_REVIEW' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        kycStatus: 'VERIFIED',
      });

      const result = await service.approveKyc('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        kycStatus: 'VERIFIED',
        success: true,
        message: 'KYC verificado exitosamente',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          kycStatus: 'VERIFIED',
          kycVerifiedAt: expect.any(Date),
          kycRejectedReason: null,
        },
        select: {
          id: true,
          kycStatus: true,
        },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.approveKyc('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if KYC is not in PENDING_REVIEW status', async () => {
      const user = createTestUser({ kycStatus: 'VERIFIED' });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.approveKyc('user-1')).rejects.toThrow(
        'KYC is not in PENDING_REVIEW status',
      );
    });
  });

  describe('rejectKyc', () => {
    it('should reject pending KYC submission with reason', async () => {
      const user = createTestUser({ kycStatus: 'PENDING_REVIEW' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        kycStatus: 'REJECTED',
      });

      const result = await service.rejectKyc(
        'user-1',
        'Documento ilegible, por favor volver a subir',
      );

      expect(result).toEqual({
        userId: 'user-1',
        kycStatus: 'REJECTED',
        success: true,
        message: 'KYC rechazado',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          kycStatus: 'REJECTED',
          kycRejectedReason: 'Documento ilegible, por favor volver a subir',
        },
        select: {
          id: true,
          kycStatus: true,
        },
      });
    });

    it('should throw error if rejection reason is too short', async () => {
      await expect(service.rejectKyc('user-1', 'Short')).rejects.toThrow(
        'Rejection reason must be at least 10 characters',
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectKyc('user-1', 'Valid reason here'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if KYC is not in PENDING_REVIEW status', async () => {
      const user = createTestUser({ kycStatus: 'VERIFIED' });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.rejectKyc('user-1', 'Valid reason here'),
      ).rejects.toThrow('KYC is not in PENDING_REVIEW status');
    });
  });
});
