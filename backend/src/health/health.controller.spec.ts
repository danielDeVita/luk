import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

type MockPrismaService = {
  $queryRaw: jest.Mock;
};

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: MockPrismaService;

  const mockPrismaService = (): MockPrismaService => ({
    $queryRaw: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: mockPrismaService() }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get(PrismaService) as unknown as MockPrismaService;
  });

  describe('check', () => {
    it('should return healthy status when database is OK', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.check();

      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(result.status).toBe('healthy');
      expect(result.database).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.version).toBeDefined();
    });

    it('should return unhealthy status when database fails', async () => {
      prismaService.$queryRaw.mockRejectedValue(
        new Error('Database connection error'),
      );

      const result = await controller.check();

      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(result.status).toBe('unhealthy');
      expect(result.database).toBe(false);
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('readiness', () => {
    it('should return ready true when database is accessible', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.readiness();

      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual({ ready: true });
    });

    it('should return ready false when database is not accessible', async () => {
      prismaService.$queryRaw.mockRejectedValue(
        new Error('Database unavailable'),
      );

      const result = await controller.readiness();

      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual({ ready: false });
    });
  });

  describe('liveness', () => {
    it('should always return alive true', () => {
      const result = controller.liveness();

      expect(result).toEqual({ alive: true });
    });
  });
});
