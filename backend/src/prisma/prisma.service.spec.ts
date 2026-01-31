import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    // Mock Prisma Client methods to avoid real DB connections
    service.$connect = jest.fn();
    service.$disconnect = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have PrismaClient methods', () => {
    expect(service.$connect).toBeDefined();
    expect(service.$disconnect).toBeDefined();
    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');
  });

  it('should call $connect on module initialization', async () => {
    await service.onModuleInit();

    expect(service.$connect).toHaveBeenCalledTimes(1);
  });

  it('should call $disconnect on module destruction', async () => {
    await service.onModuleDestroy();

    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });
});
