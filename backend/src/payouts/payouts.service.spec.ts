import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import { PayoutStatus, Prisma } from '@prisma/client';

type MockPrismaService = {
  raffle: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  payout: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
};

type MockNotificationsService = {
  create: jest.Mock;
};

type MockAuditService = {
  logPayoutReleased: jest.Mock;
};

type MockPaymentsService = {
  releaseFundsToSeller: jest.Mock;
  canReleaseFunds: jest.Mock;
};

describe('PayoutsService', () => {
  let service: PayoutsService;
  let prisma: MockPrismaService;
  let notifications: MockNotificationsService;
  let audit: MockAuditService;
  let paymentsService: MockPaymentsService;

  const mockPrismaService = (): MockPrismaService => ({
    raffle: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payout: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  });

  const mockNotificationsService = (): MockNotificationsService => ({
    create: jest.fn(),
  });

  const mockAuditService = (): MockAuditService => ({
    logPayoutReleased: jest.fn(),
  });

  const mockPaymentsService = (): MockPaymentsService => ({
    releaseFundsToSeller: jest.fn(),
    canReleaseFunds: jest
      .fn()
      .mockResolvedValue({ canRelease: true, reason: 'OK' }),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: NotificationsService, useValue: mockNotificationsService() },
        { provide: AuditService, useValue: mockAuditService() },
        {
          provide: PaymentsService,
          useValue: mockPaymentsService(),
        },
      ],
    }).compile();

    service = module.get<PayoutsService>(PayoutsService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    notifications = module.get(
      NotificationsService,
    ) as unknown as MockNotificationsService;
    audit = module.get(AuditService) as unknown as MockAuditService;
    paymentsService = module.get(
      PaymentsService,
    ) as unknown as MockPaymentsService;
  });

  describe('createPayout', () => {
    it('should calculate fees correctly (4% platform + 5% MP estimate)', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        tickets: [
          { precioPagado: new Prisma.Decimal(5000) },
          { precioPagado: new Prisma.Decimal(5000) },
        ],
        payout: null,
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.payout.create.mockResolvedValue({
        id: 'payout-1',
        raffleId: 'raffle-1',
        sellerId: 'seller-1',
        grossAmount: 10000,
        platformFee: 400, // 4% of 10000
        processingFee: 500, // 5% of 10000
        netAmount: 9100, // 10000 - 400 - 500
        status: PayoutStatus.PENDING,
      });

      const result = await service.createPayout('raffle-1');

      expect(prisma.payout.create).toHaveBeenCalledWith({
        data: {
          raffleId: 'raffle-1',
          sellerId: 'seller-1',
          grossAmount: 10000,
          platformFee: 400,
          processingFee: 500,
          netAmount: 9100,
          status: PayoutStatus.PENDING,
        },
      });
      expect(result.netAmount).toBe(9100);
    });

    it('should return existing payout if already exists', async () => {
      const existingPayout = {
        id: 'payout-1',
        raffleId: 'raffle-1',
        netAmount: 9100,
      };

      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        tickets: [{ precioPagado: new Prisma.Decimal(10000) }],
        payout: existingPayout,
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);

      const result = await service.createPayout('raffle-1');

      expect(result).toEqual(existingPayout);
      expect(prisma.payout.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid raffle', async () => {
      prisma.raffle.findUnique.mockResolvedValue(null);

      await expect(service.createPayout('invalid-raffle')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should sum only PAGADO tickets', async () => {
      const mockRaffle = {
        id: 'raffle-1',
        sellerId: 'seller-1',
        tickets: [
          { precioPagado: new Prisma.Decimal(1000) },
          { precioPagado: new Prisma.Decimal(1000) },
          { precioPagado: new Prisma.Decimal(1000) },
        ],
        payout: null,
      };

      prisma.raffle.findUnique.mockResolvedValue(mockRaffle);
      prisma.payout.create.mockResolvedValue({
        id: 'payout-1',
        grossAmount: 3000,
        platformFee: 120,
        processingFee: 150,
        netAmount: 2730,
      });

      await service.createPayout('raffle-1');

      // Verify query includes PAGADO filter
      expect(prisma.raffle.findUnique).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        include: {
          tickets: { where: { estado: 'PAGADO' } },
          payout: true,
        },
      });
    });
  });

  describe('schedulePayoutAfterDelivery', () => {
    it('should set scheduledFor to 7 days from now', async () => {
      const existingPayout = { id: 'payout-1', raffleId: 'raffle-1' };
      prisma.payout.findUnique.mockResolvedValue(existingPayout);
      prisma.payout.update.mockResolvedValue({
        ...existingPayout,
        scheduledFor: new Date(),
      });
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'seller-1',
        titulo: 'iPhone 15 Pro',
      });

      const now = Date.now();
      await service.schedulePayoutAfterDelivery('raffle-1');

      const callArgs = prisma.payout.update.mock.calls[0][0];
      const scheduledFor = callArgs.data.scheduledFor as Date;
      const daysDiff = (scheduledFor.getTime() - now) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeGreaterThanOrEqual(6.9);
      expect(daysDiff).toBeLessThanOrEqual(7.1);
    });

    it('should create payout if does not exist', async () => {
      prisma.payout.findUnique.mockResolvedValue(null);
      prisma.raffle.findUnique
        .mockResolvedValueOnce({
          id: 'raffle-1',
          sellerId: 'seller-1',
          tickets: [{ precioPagado: new Prisma.Decimal(5000) }],
          payout: null,
        })
        .mockResolvedValueOnce({
          id: 'raffle-1',
          sellerId: 'seller-1',
          titulo: 'iPhone 15 Pro',
        });

      prisma.payout.create.mockResolvedValue({
        id: 'payout-1',
        raffleId: 'raffle-1',
      });
      prisma.payout.update.mockResolvedValue({
        id: 'payout-1',
        scheduledFor: new Date(),
      });

      await service.schedulePayoutAfterDelivery('raffle-1');

      expect(prisma.payout.create).toHaveBeenCalled();
    });

    it('should send seller notification', async () => {
      prisma.payout.findUnique.mockResolvedValue({
        id: 'payout-1',
        raffleId: 'raffle-1',
      });
      prisma.payout.update.mockResolvedValue({
        id: 'payout-1',
        scheduledFor: new Date(),
      });
      prisma.raffle.findUnique.mockResolvedValue({
        id: 'raffle-1',
        sellerId: 'seller-1',
        titulo: 'iPhone 15 Pro',
      });

      await service.schedulePayoutAfterDelivery('raffle-1');

      expect(notifications.create).toHaveBeenCalledWith(
        'seller-1',
        'INFO',
        'Pago programado',
        expect.stringContaining('Tu pago por "iPhone 15 Pro"'),
      );
    });
  });

  describe('processDuePayouts', () => {
    it('should process payouts with scheduledFor <= now', async () => {
      const mockPayouts = [
        {
          id: 'payout-1',
          raffleId: 'raffle-1',
          sellerId: 'seller-1',
          status: PayoutStatus.PENDING,
          scheduledFor: new Date(Date.now() - 1000),
          raffle: {
            sellerId: 'seller-1',
            titulo: 'iPhone 15 Pro',
            deliveryStatus: 'CONFIRMED',
            seller: {
              id: 'seller-1',
              mpUserId: 'mp-123',
              mpAccessToken: 'token-123',
              email: 'seller@test.com',
            },
          },
        },
      ];

      prisma.payout.findMany.mockResolvedValue(mockPayouts);
      prisma.payout.findUnique.mockResolvedValue(mockPayouts[0]);
      prisma.payout.update.mockResolvedValue({
        status: PayoutStatus.COMPLETED,
      });
      prisma.raffle.update.mockResolvedValue({});
      paymentsService.releaseFundsToSeller.mockResolvedValue({
        success: true,
        releasedPayments: 1,
        errors: [],
      });

      await service.processDuePayouts();

      expect(prisma.payout.findMany).toHaveBeenCalledWith({
        where: {
          status: PayoutStatus.PENDING,
          scheduledFor: { lte: expect.any(Date) },
        },
        include: {
          raffle: {
            select: { sellerId: true, titulo: true, deliveryStatus: true },
          },
        },
      });
    });

    it('should skip if delivery not CONFIRMED', async () => {
      const mockPayouts = [
        {
          id: 'payout-1',
          status: PayoutStatus.PENDING,
          raffle: {
            deliveryStatus: 'PENDING', // Not confirmed
            sellerId: 'seller-1',
            titulo: 'Test',
          },
        },
      ];

      prisma.payout.findMany.mockResolvedValue(mockPayouts);

      await service.processDuePayouts();

      expect(prisma.payout.update).not.toHaveBeenCalled();
      expect(paymentsService.releaseFundsToSeller).not.toHaveBeenCalled();
    });

    it('should handle errors without stopping batch', async () => {
      const mockPayouts = [
        {
          id: 'payout-1',
          raffle: { deliveryStatus: 'CONFIRMED', sellerId: 's1', titulo: 'T1' },
        },
        {
          id: 'payout-2',
          raffle: { deliveryStatus: 'CONFIRMED', sellerId: 's2', titulo: 'T2' },
        },
      ];

      prisma.payout.findMany.mockResolvedValue(mockPayouts);
      prisma.payout.findUnique.mockResolvedValue(null); // Cause error

      // Should not throw, just log
      await expect(service.processDuePayouts()).resolves.not.toThrow();
    });
  });

  describe('processPayout', () => {
    it('should validate payout status is PENDING', async () => {
      const mockPayout = {
        id: 'payout-1',
        status: PayoutStatus.COMPLETED, // Already completed
        raffle: {
          seller: { id: 'seller-1', email: 'seller@test.com' },
        },
      };

      prisma.payout.findUnique.mockResolvedValue(mockPayout);

      await expect(service.processPayout('payout-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call releaseFundsToSeller with correct params', async () => {
      const mockPayout = {
        id: 'payout-1',
        raffleId: 'raffle-1',
        status: PayoutStatus.PENDING,
        netAmount: 9100,
        raffle: {
          titulo: 'iPhone 15 Pro',
          seller: {
            id: 'seller-1',
            mpUserId: 'mp-123',
            mpAccessToken: 'token-123',
            email: 'seller@test.com',
          },
        },
      };

      prisma.payout.findUnique.mockResolvedValue(mockPayout);
      prisma.payout.update.mockResolvedValue({});
      prisma.raffle.update.mockResolvedValue({});
      paymentsService.releaseFundsToSeller.mockResolvedValue({
        success: true,
        releasedPayments: 1,
        errors: [],
      });

      await service.processPayout('payout-1');

      expect(paymentsService.releaseFundsToSeller).toHaveBeenCalledWith(
        'raffle-1',
      );
    });

    it('should update raffle to FINALIZADA on success', async () => {
      const mockPayout = {
        id: 'payout-1',
        raffleId: 'raffle-1',
        status: PayoutStatus.PENDING,
        netAmount: 9100,
        raffle: {
          titulo: 'iPhone 15 Pro',
          seller: {
            id: 'seller-1',
            mpUserId: 'mp-123',
            mpAccessToken: 'token-123',
            email: 'seller@test.com',
          },
        },
      };

      prisma.payout.findUnique.mockResolvedValue(mockPayout);
      prisma.payout.update.mockResolvedValue({});
      prisma.raffle.update.mockResolvedValue({});
      paymentsService.releaseFundsToSeller.mockResolvedValue({
        success: true,
        releasedPayments: 1,
        errors: [],
      });

      await service.processPayout('payout-1');

      expect(prisma.raffle.update).toHaveBeenCalledWith({
        where: { id: 'raffle-1' },
        data: {
          paymentReleasedAt: expect.any(Date),
          estado: 'FINALIZADA',
        },
      });
    });

    it('should update payout to FAILED on error', async () => {
      const mockPayout = {
        id: 'payout-1',
        raffleId: 'raffle-1',
        status: PayoutStatus.PENDING,
        raffle: {
          titulo: 'iPhone 15 Pro',
          seller: {
            id: 'seller-1',
            mpUserId: 'mp-123',
            mpAccessToken: 'token-123',
            email: 'seller@test.com',
          },
        },
      };

      prisma.payout.findUnique.mockResolvedValue(mockPayout);
      prisma.payout.update.mockResolvedValue({});
      paymentsService.releaseFundsToSeller.mockRejectedValue(
        new Error('MP API error'),
      );

      await expect(service.processPayout('payout-1')).rejects.toThrow();

      // Verify it was marked as FAILED
      expect(prisma.payout.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'payout-1' },
          data: expect.objectContaining({
            status: PayoutStatus.FAILED,
            failureReason: expect.stringContaining('MP API error'),
          }),
        }),
      );
    });
  });

  describe('releasePayoutManually', () => {
    it('should log audit action with admin details', async () => {
      const mockPayout = {
        id: 'payout-1',
        raffleId: 'raffle-1',
        status: PayoutStatus.PENDING,
        netAmount: 9100,
        raffle: {
          titulo: 'iPhone 15 Pro',
          seller: {
            id: 'seller-1',
            mpUserId: 'mp-123',
            mpAccessToken: 'token-123',
            email: 'seller@test.com',
          },
        },
      };

      prisma.payout.findUnique.mockResolvedValue(mockPayout);
      prisma.payout.update.mockResolvedValue({});
      prisma.raffle.update.mockResolvedValue({});
      paymentsService.releaseFundsToSeller.mockResolvedValue({
        success: true,
        releasedPayments: 1,
        errors: [],
      });

      await service.releasePayoutManually(
        'admin-1',
        'payout-1',
        'Dispute resolved in seller favor',
      );

      expect(audit.logPayoutReleased).toHaveBeenCalledWith(
        'admin-1',
        'payout-1',
        {
          reason: 'Dispute resolved in seller favor',
          amount: 9100,
          raffleTitulo: 'iPhone 15 Pro',
        },
      );
    });
  });
});
