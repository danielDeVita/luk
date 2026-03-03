import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DisputeTasksService } from './dispute-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { DisputesService } from '../disputes/disputes.service';

type MockPrismaService = {
  dispute: {
    findMany: jest.Mock;
    update: jest.Mock;
  };
  ticket: {
    findMany: jest.Mock;
  };
};

type MockDisputesService = {
  resolveDisputeBySystem: jest.Mock;
};

describe('DisputeTasksService', () => {
  let service: DisputeTasksService;
  let prisma: MockPrismaService;
  let disputesService: MockDisputesService;

  const mockPrismaService = (): MockPrismaService => ({
    dispute: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    ticket: {
      findMany: jest.fn(),
    },
  });

  const mockDisputesService = (): MockDisputesService => ({
    resolveDisputeBySystem: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeTasksService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: DisputesService, useValue: mockDisputesService() },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'ENABLE_CRON_JOBS' ? 'true' : null,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<DisputeTasksService>(DisputeTasksService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
    disputesService = module.get(
      DisputesService,
    ) as unknown as MockDisputesService;
  });

  describe('processDisputeEscalations', () => {
    it('should skip if ENABLE_CRON_JOBS is false', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DisputeTasksService,
          { provide: PrismaService, useValue: mockPrismaService() },
          { provide: DisputesService, useValue: mockDisputesService() },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) =>
                key === 'ENABLE_CRON_JOBS' ? 'false' : null,
              ),
            },
          },
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
      prisma.dispute.findMany
        .mockResolvedValueOnce([
          {
            id: 'dispute-1',
            estado: 'ESPERANDO_RESPUESTA_VENDEDOR',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 49),
            fechaRespuestaVendedor: null,
            raffle: { seller: { id: 'seller-1' } },
          },
        ])
        .mockResolvedValueOnce([]);
      prisma.dispute.update.mockResolvedValue({});

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
      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        data: {
          estado: 'EN_MEDIACION',
          adminNotes: expect.stringContaining('falta de respuesta'),
        },
      });
    });
  });

  describe('autoRefundOldDisputes (via processDisputeEscalations)', () => {
    it('should resolve old disputes through DisputesService with buyer-scoped amount', async () => {
      prisma.dispute.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 'dispute-1',
          raffleId: 'raffle-1',
          reporterId: 'buyer-1',
          estado: 'ABIERTA',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 16),
          resolvedAt: null,
          raffle: { titulo: 'iPhone 15 Pro' },
          reporter: { id: 'buyer-1', email: 'buyer@test.com' },
        },
      ]);
      prisma.ticket.findMany.mockResolvedValue([
        { precioPagado: new Prisma.Decimal(500) },
        { precioPagado: new Prisma.Decimal(700) },
      ]);
      disputesService.resolveDisputeBySystem.mockResolvedValue({});

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
          raffle: { select: { titulo: true } },
          reporter: true,
        },
      });
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: {
          raffleId: 'raffle-1',
          buyerId: 'buyer-1',
          estado: 'PAGADO',
        },
        select: { precioPagado: true },
      });
      expect(disputesService.resolveDisputeBySystem).toHaveBeenCalledWith(
        'dispute-1',
        expect.objectContaining({
          decision: 'RESUELTA_COMPRADOR',
          montoReembolsado: 1200,
          montoPagadoVendedor: 0,
        }),
      );
    });
  });
});
