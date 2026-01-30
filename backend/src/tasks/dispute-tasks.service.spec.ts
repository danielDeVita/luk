import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DisputeTasksService } from './dispute-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

type MockPrismaService = {
  dispute: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
  raffle: {
    update: jest.Mock;
  };
};

type MockPaymentsService = {
  refundPayment: jest.Mock;
};

type MockNotificationsService = {
  sendDisputeResolvedNotification: jest.Mock;
};

describe('DisputeTasksService', () => {
  let service: DisputeTasksService;
  let prisma: MockPrismaService;
  let _paymentsService: MockPaymentsService;
  let notificationsService: MockNotificationsService;
  let _configService: ConfigService;

  const mockPrismaService = (): MockPrismaService => ({
    dispute: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    raffle: {
      update: jest.fn(),
    },
  });

  const mockPaymentsService = (): MockPaymentsService => ({
    refundPayment: jest.fn(),
  });

  const mockNotificationsService = (): MockNotificationsService => ({
    sendDisputeResolvedNotification: jest.fn(),
  });

  let mockConfigServiceGet: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigServiceGet = jest.fn((key: string) => {
      if (key === 'ENABLE_CRON_JOBS') return 'true';
      return null;
    });

    const mockConfigService = {
      get: mockConfigServiceGet,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeTasksService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: PaymentsService, useValue: mockPaymentsService() },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService(),
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DisputeTasksService>(DisputeTasksService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    _paymentsService = module.get(
      PaymentsService,
    ) as unknown as MockPaymentsService;
    notificationsService = module.get(
      NotificationsService,
    ) as unknown as MockNotificationsService;
    _configService = module.get<ConfigService>(ConfigService);
  });

  describe('processDisputeEscalations', () => {
    it('should skip if ENABLE_CRON_JOBS is false', async () => {
      // Recreate service with cron disabled
      const disabledConfigMock = jest.fn((key: string) => {
        if (key === 'ENABLE_CRON_JOBS') return 'false';
        return null;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DisputeTasksService,
          { provide: PrismaService, useValue: mockPrismaService() },
          { provide: PaymentsService, useValue: mockPaymentsService() },
          {
            provide: NotificationsService,
            useValue: mockNotificationsService(),
          },
          { provide: ConfigService, useValue: { get: disabledConfigMock } },
        ],
      }).compile();

      const disabledService =
        module.get<DisputeTasksService>(DisputeTasksService);
      const disabledPrisma = module.get(
        PrismaService,
      ) as unknown as MockPrismaService;

      await disabledService.processDisputeEscalations();

      expect(disabledPrisma.dispute.findMany).not.toHaveBeenCalled();
    });
  });

  describe('escalateUnrespondedDisputes (via processDisputeEscalations)', () => {
    it('should escalate disputes without seller response after 48h', async () => {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

      const mockDispute = {
        id: 'dispute-1',
        estado: 'ESPERANDO_RESPUESTA_VENDEDOR',
        createdAt: fortyEightHoursAgo,
        fechaRespuestaVendedor: null,
        raffleId: 'raffle-1',
        raffle: {
          id: 'raffle-1',
          titulo: 'iPhone 15 Pro',
          seller: {
            id: 'seller-1',
            email: 'seller@test.com',
          },
        },
      };

      // processDisputeEscalations calls findMany twice:
      // 1. escalateUnrespondedDisputes
      // 2. autoRefundOldDisputes
      prisma.dispute.findMany
        .mockResolvedValueOnce([mockDispute]) // escalateUnrespondedDisputes
        .mockResolvedValueOnce([]); // autoRefundOldDisputes

      prisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        estado: 'EN_MEDIACION',
      });

      await service.processDisputeEscalations();

      expect(prisma.dispute.findMany).toHaveBeenCalledWith({
        where: {
          estado: 'ESPERANDO_RESPUESTA_VENDEDOR',
          createdAt: { lte: expect.any(Date) },
          fechaRespuestaVendedor: null,
          isDeleted: false,
        },
        include: {
          raffle: { include: { seller: true } },
        },
      });
    });

    it('should change status to EN_MEDIACION', async () => {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

      const mockDispute = {
        id: 'dispute-1',
        estado: 'ESPERANDO_RESPUESTA_VENDEDOR',
        createdAt: fortyEightHoursAgo,
        fechaRespuestaVendedor: null,
        raffle: {
          seller: { id: 'seller-1', email: 'seller@test.com' },
        },
      };

      prisma.dispute.findMany
        .mockResolvedValueOnce([mockDispute])
        .mockResolvedValueOnce([]);

      prisma.dispute.update.mockResolvedValue({});

      await service.processDisputeEscalations();

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        data: {
          estado: 'EN_MEDIACION',
          adminNotes: expect.stringContaining('falta de respuesta'),
        },
      });
    });

    it('should send notification to admin (via log)', async () => {
      const fortyEightHoursAgo = new Date();
      fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

      const mockDispute = {
        id: 'dispute-1',
        estado: 'ESPERANDO_RESPUESTA_VENDEDOR',
        createdAt: fortyEightHoursAgo,
        fechaRespuestaVendedor: null,
        raffle: {
          seller: { id: 'seller-1', email: 'seller@test.com' },
        },
      };

      prisma.dispute.findMany
        .mockResolvedValueOnce([mockDispute])
        .mockResolvedValueOnce([]);

      prisma.dispute.update.mockResolvedValue({});

      // This test verifies that escalation happens without throwing
      await expect(service.processDisputeEscalations()).resolves.not.toThrow();

      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dispute-1' },
        }),
      );
    });
  });

  describe('autoRefundOldDisputes (via processDisputeEscalations)', () => {
    it('should auto-resolve disputes after 15 days', async () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const mockDispute = {
        id: 'dispute-1',
        estado: 'ABIERTA',
        createdAt: fifteenDaysAgo,
        raffleId: 'raffle-1',
        resolvedAt: null,
        raffle: {
          id: 'raffle-1',
          titulo: 'iPhone 15 Pro',
          seller: {
            id: 'seller-1',
            email: 'seller@test.com',
          },
          tickets: [
            { precioPagado: new Prisma.Decimal(1000) },
            { precioPagado: new Prisma.Decimal(1000) },
          ],
        },
        reporter: {
          id: 'buyer-1',
          email: 'buyer@test.com',
        },
      };

      // processDisputeEscalations calls findMany twice
      prisma.dispute.findMany
        .mockResolvedValueOnce([]) // escalateUnrespondedDisputes
        .mockResolvedValueOnce([mockDispute]); // autoRefundOldDisputes

      prisma.dispute.update.mockResolvedValue({});
      prisma.raffle.update.mockResolvedValue({});
      notificationsService.sendDisputeResolvedNotification.mockResolvedValue(
        true,
      );

      await service.processDisputeEscalations();

      expect(prisma.dispute.findMany).toHaveBeenCalledWith({
        where: {
          estado: {
            in: ['ABIERTA', 'ESPERANDO_RESPUESTA_VENDEDOR', 'EN_MEDIACION'],
          },
          createdAt: { lte: expect.any(Date) },
          resolvedAt: null,
          isDeleted: false,
        },
        include: {
          raffle: {
            include: {
              seller: true,
              tickets: { where: { estado: 'PAGADO' } },
            },
          },
          reporter: true,
        },
      });
    });

    it('should process refund to buyer', async () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const mockDispute = {
        id: 'dispute-1',
        estado: 'ABIERTA',
        createdAt: fifteenDaysAgo,
        raffleId: 'raffle-1',
        resolvedAt: null,
        raffle: {
          id: 'raffle-1',
          titulo: 'iPhone 15 Pro',
          seller: { id: 'seller-1', email: 'seller@test.com' },
          tickets: [
            { precioPagado: new Prisma.Decimal(500) },
            { precioPagado: new Prisma.Decimal(500) },
            { precioPagado: new Prisma.Decimal(500) },
          ],
        },
        reporter: { id: 'buyer-1', email: 'buyer@test.com' },
      };

      prisma.dispute.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockDispute]);

      prisma.dispute.update.mockResolvedValue({});
      prisma.raffle.update.mockResolvedValue({});

      await service.processDisputeEscalations();

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        data: expect.objectContaining({
          estado: 'RESUELTA_COMPRADOR',
          resolvedAt: expect.any(Date),
          montoReembolsado: 1500, // 500 * 3
          montoPagadoVendedor: 0,
        }),
      });
    });

    it('should send resolution notification', async () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const mockDispute = {
        id: 'dispute-1',
        estado: 'ABIERTA',
        createdAt: fifteenDaysAgo,
        raffleId: 'raffle-1',
        resolvedAt: null,
        raffle: {
          id: 'raffle-1',
          titulo: 'iPhone 15 Pro',
          seller: { id: 'seller-1', email: 'seller@test.com' },
          tickets: [{ precioPagado: new Prisma.Decimal(1000) }],
        },
        reporter: { id: 'buyer-1', email: 'buyer@test.com' },
      };

      prisma.dispute.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockDispute]);

      prisma.dispute.update.mockResolvedValue({});
      prisma.raffle.update.mockResolvedValue({});
      notificationsService.sendDisputeResolvedNotification.mockResolvedValue(
        true,
      );

      await service.processDisputeEscalations();

      // Should send notification to buyer
      expect(
        notificationsService.sendDisputeResolvedNotification,
      ).toHaveBeenCalledWith('buyer@test.com', {
        raffleName: 'iPhone 15 Pro',
        resolution: 'Resuelto a tu favor (tiempo de espera excedido)',
        refundAmount: 1000,
      });

      // Should send notification to seller
      expect(
        notificationsService.sendDisputeResolvedNotification,
      ).toHaveBeenCalledWith('seller@test.com', {
        raffleName: 'iPhone 15 Pro',
        resolution: 'Resuelto a favor del comprador por tiempo excedido',
      });
    });
  });
});
