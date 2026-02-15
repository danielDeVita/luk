import { PrismaService } from '../../prisma/prisma.service';
import { BaseRepository } from './base.repository';

// Mock entity type for testing
interface TestEntity {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface TestCreateInput {
  name: string;
  email: string;
}

interface TestUpdateInput {
  name?: string;
  email?: string;
}

interface TestWhereInput {
  id?: string;
  email?: string;
  name?: string;
}

interface TestOrderByInput {
  createdAt?: 'asc' | 'desc';
  name?: 'asc' | 'desc';
}

interface TestIncludeInput {
  related?: boolean;
}

// Mock Prisma delegate methods
type MockDelegate = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
  upsert: jest.Mock;
};

// Create a simple mock repository that doesn't rely on complex injection
describe('BaseRepository', () => {
  const mockEntity: TestEntity = {
    id: 'test-id-123',
    name: 'Test Entity',
    email: 'test@example.com',
    createdAt: new Date('2024-01-01'),
  };

  let mockDelegate: MockDelegate;
  let mockPrisma: { user: MockDelegate; $transaction: jest.Mock };

  // Create a concrete implementation for testing
  class TestRepository extends BaseRepository<
    TestEntity,
    TestCreateInput,
    TestUpdateInput,
    TestWhereInput,
    TestOrderByInput,
    TestIncludeInput
  > {
    constructor() {
      // Pass mockPrisma as PrismaService
      super(mockPrisma as unknown as PrismaService);
    }

    protected get delegate(): MockDelegate {
      return mockDelegate;
    }
  }

  let repository: TestRepository;

  const createMockDelegate = (): MockDelegate => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDelegate = createMockDelegate();
    mockPrisma = {
      user: mockDelegate,
      $transaction: jest.fn(),
    };
    repository = new TestRepository();
  });

  describe('findById', () => {
    it('should find an entity by ID without includes', async () => {
      mockDelegate.findUnique.mockResolvedValue(mockEntity);

      const result = await repository.findById('test-id-123');

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id-123' },
      });
    });

    it('should find an entity by ID with includes', async () => {
      mockDelegate.findUnique.mockResolvedValue(mockEntity);
      const include = { related: true };

      const result = await repository.findById('test-id-123', include);

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id-123' },
        include,
      });
    });

    it('should return null when entity not found', async () => {
      mockDelegate.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should find first entity matching criteria', async () => {
      mockDelegate.findFirst.mockResolvedValue(mockEntity);
      const where = { email: 'test@example.com' };

      const result = await repository.findOne(where);

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.findFirst).toHaveBeenCalledWith({
        where,
      });
    });

    it('should find first entity with includes', async () => {
      mockDelegate.findFirst.mockResolvedValue(mockEntity);
      const where = { email: 'test@example.com' };
      const include = { related: true };

      const result = await repository.findOne(where, include);

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.findFirst).toHaveBeenCalledWith({
        where,
        include,
      });
    });

    it('should return null when no entity matches', async () => {
      mockDelegate.findFirst.mockResolvedValue(null);

      const result = await repository.findOne({
        email: 'nonexistent@example.com',
      });

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should find all entities without options', async () => {
      const entities = [mockEntity, { ...mockEntity, id: 'test-id-456' }];
      mockDelegate.findMany.mockResolvedValue(entities);

      const result = await repository.findMany();

      expect(result).toEqual(entities);
      expect(mockDelegate.findMany).toHaveBeenCalledWith({});
    });

    it('should find entities with where clause', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      const where = { name: 'Test Entity' };

      const result = await repository.findMany({ where });

      expect(result).toEqual(entities);
      expect(mockDelegate.findMany).toHaveBeenCalledWith({ where });
    });

    it('should find entities with orderBy', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      const orderBy = { createdAt: 'desc' as const };

      const result = await repository.findMany({ orderBy });

      expect(result).toEqual(entities);
      expect(mockDelegate.findMany).toHaveBeenCalledWith({ orderBy });
    });

    it('should find entities with pagination', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      const skip = 10;
      const take = 5;

      const result = await repository.findMany({ skip, take });

      expect(result).toEqual(entities);
      expect(mockDelegate.findMany).toHaveBeenCalledWith({ skip, take });
    });

    it('should find entities with includes', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      const include = { related: true };

      const result = await repository.findMany({ include });

      expect(result).toEqual(entities);
      expect(mockDelegate.findMany).toHaveBeenCalledWith({ include });
    });

    it('should find entities with all options combined', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      const options = {
        where: { name: 'Test' },
        orderBy: { createdAt: 'desc' as const },
        include: { related: true },
        skip: 0,
        take: 10,
      };

      const result = await repository.findMany(options);

      expect(result).toEqual(entities);
      expect(mockDelegate.findMany).toHaveBeenCalledWith(options);
    });
  });

  describe('findManyPaginated', () => {
    it('should return paginated results with default values', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      mockDelegate.count.mockResolvedValue(25);

      const result = await repository.findManyPaginated();

      expect(result.items).toEqual(entities);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrevious).toBe(false);
      expect(mockDelegate.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
      });
      expect(mockDelegate.count).toHaveBeenCalledWith({ where: undefined });
    });

    it('should handle custom page and limit', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      mockDelegate.count.mockResolvedValue(50);

      const result = await repository.findManyPaginated({ page: 2, limit: 20 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrevious).toBe(true);
      expect(mockDelegate.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 20,
      });
    });

    it('should handle last page correctly', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      mockDelegate.count.mockResolvedValue(15);

      const result = await repository.findManyPaginated({ page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(true);
    });

    it('should handle first page correctly', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      mockDelegate.count.mockResolvedValue(15);

      const result = await repository.findManyPaginated({ page: 1, limit: 10 });

      expect(result.hasNext).toBe(true);
      expect(result.hasPrevious).toBe(false);
    });

    it('should handle single page correctly', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      mockDelegate.count.mockResolvedValue(5);

      const result = await repository.findManyPaginated({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(false);
    });

    it('should pass where, orderBy, and include to both queries', async () => {
      const entities = [mockEntity];
      mockDelegate.findMany.mockResolvedValue(entities);
      mockDelegate.count.mockResolvedValue(10);

      const options = {
        where: { name: 'Test' },
        orderBy: { createdAt: 'desc' as const },
        include: { related: true },
        page: 1,
        limit: 5,
      };

      await repository.findManyPaginated(options);

      expect(mockDelegate.findMany).toHaveBeenCalledWith({
        where: options.where,
        orderBy: options.orderBy,
        include: options.include,
        skip: 0,
        take: 5,
      });
      expect(mockDelegate.count).toHaveBeenCalledWith({
        where: options.where,
      });
    });

    it('should handle empty results', async () => {
      mockDelegate.findMany.mockResolvedValue([]);
      mockDelegate.count.mockResolvedValue(0);

      const result = await repository.findManyPaginated();

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(false);
    });
  });

  describe('create', () => {
    it('should create an entity without includes', async () => {
      mockDelegate.create.mockResolvedValue(mockEntity);
      const data = { name: 'Test Entity', email: 'test@example.com' };

      const result = await repository.create(data);

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.create).toHaveBeenCalledWith({
        data,
      });
    });

    it('should create an entity with includes', async () => {
      mockDelegate.create.mockResolvedValue(mockEntity);
      const data = { name: 'Test Entity', email: 'test@example.com' };
      const include = { related: true };

      const result = await repository.create(data, include);

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.create).toHaveBeenCalledWith({
        data,
        include,
      });
    });
  });

  describe('update', () => {
    it('should update an entity by ID without includes', async () => {
      const updatedEntity = { ...mockEntity, name: 'Updated Name' };
      mockDelegate.update.mockResolvedValue(updatedEntity);
      const data = { name: 'Updated Name' };

      const result = await repository.update('test-id-123', data);

      expect(result).toEqual(updatedEntity);
      expect(mockDelegate.update).toHaveBeenCalledWith({
        where: { id: 'test-id-123' },
        data,
      });
    });

    it('should update an entity by ID with includes', async () => {
      const updatedEntity = { ...mockEntity, name: 'Updated Name' };
      mockDelegate.update.mockResolvedValue(updatedEntity);
      const data = { name: 'Updated Name' };
      const include = { related: true };

      const result = await repository.update('test-id-123', data, include);

      expect(result).toEqual(updatedEntity);
      expect(mockDelegate.update).toHaveBeenCalledWith({
        where: { id: 'test-id-123' },
        data,
        include,
      });
    });
  });

  describe('updateWhere', () => {
    it('should update first entity matching criteria', async () => {
      const updatedEntity = { ...mockEntity, name: 'Updated Name' };
      mockDelegate.update.mockResolvedValue(updatedEntity);
      const where = { email: 'test@example.com' };
      const data = { name: 'Updated Name' };

      const result = await repository.updateWhere(where, data);

      expect(result).toEqual(updatedEntity);
      expect(mockDelegate.update).toHaveBeenCalledWith({
        where,
        data,
      });
    });

    it('should update with includes', async () => {
      const updatedEntity = { ...mockEntity, name: 'Updated Name' };
      mockDelegate.update.mockResolvedValue(updatedEntity);
      const where = { email: 'test@example.com' };
      const data = { name: 'Updated Name' };
      const include = { related: true };

      const result = await repository.updateWhere(where, data, include);

      expect(result).toEqual(updatedEntity);
      expect(mockDelegate.update).toHaveBeenCalledWith({
        where,
        data,
        include,
      });
    });
  });

  describe('delete', () => {
    it('should delete an entity by ID', async () => {
      mockDelegate.delete.mockResolvedValue(mockEntity);

      const result = await repository.delete('test-id-123');

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.delete).toHaveBeenCalledWith({
        where: { id: 'test-id-123' },
      });
    });
  });

  describe('count', () => {
    it('should count all entities when no where clause', async () => {
      mockDelegate.count.mockResolvedValue(100);

      const result = await repository.count();

      expect(result).toBe(100);
      expect(mockDelegate.count).toHaveBeenCalledWith({ where: undefined });
    });

    it('should count entities matching where clause', async () => {
      mockDelegate.count.mockResolvedValue(5);
      const where = { name: 'Test Entity' };

      const result = await repository.count(where);

      expect(result).toBe(5);
      expect(mockDelegate.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('exists', () => {
    it('should return true when records exist', async () => {
      mockDelegate.count.mockResolvedValue(5);
      const where = { name: 'Test Entity' };

      const result = await repository.exists(where);

      expect(result).toBe(true);
      expect(mockDelegate.count).toHaveBeenCalledWith({ where });
    });

    it('should return false when no records exist', async () => {
      mockDelegate.count.mockResolvedValue(0);
      const where = { name: 'NonExistent' };

      const result = await repository.exists(where);

      expect(result).toBe(false);
    });

    it('should return true for single matching record', async () => {
      mockDelegate.count.mockResolvedValue(1);

      const result = await repository.exists({ id: 'test-id-123' });

      expect(result).toBe(true);
    });
  });

  describe('upsert', () => {
    it('should upsert an entity without includes', async () => {
      mockDelegate.upsert.mockResolvedValue(mockEntity);
      const options = {
        where: { email: 'test@example.com' },
        create: { name: 'Test Entity', email: 'test@example.com' },
        update: { name: 'Updated Test Entity' },
      };

      const result = await repository.upsert(options);

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.upsert).toHaveBeenCalledWith({
        where: options.where,
        create: options.create,
        update: options.update,
      });
    });

    it('should upsert an entity with includes', async () => {
      mockDelegate.upsert.mockResolvedValue(mockEntity);
      const options = {
        where: { email: 'test@example.com' },
        create: { name: 'Test Entity', email: 'test@example.com' },
        update: { name: 'Updated Test Entity' },
        include: { related: true },
      };

      const result = await repository.upsert(options);

      expect(result).toEqual(mockEntity);
      expect(mockDelegate.upsert).toHaveBeenCalledWith({
        where: options.where,
        create: options.create,
        update: options.update,
        include: options.include,
      });
    });
  });

  describe('transaction', () => {
    it('should execute function within transaction', async () => {
      const transactionResult = { success: true, data: mockEntity };
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      const result = await repository.transaction(async () => {
        return transactionResult;
      });

      expect(result).toEqual(transactionResult);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should handle transaction errors', async () => {
      const error = new Error('Transaction failed');
      mockPrisma.$transaction.mockRejectedValue(error);

      await expect(
        repository.transaction(async () => {
          throw error;
        }),
      ).rejects.toThrow('Transaction failed');
    });

    it('should pass prisma client to callback', async () => {
      const mockCallback = jest.fn().mockResolvedValue('result');
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      await repository.transaction(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(mockPrisma);
    });
  });
});
