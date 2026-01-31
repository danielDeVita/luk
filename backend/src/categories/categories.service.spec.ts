import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

type MockPrismaService = {
  category: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    upsert: jest.Mock;
  };
  raffle: {
    count: jest.Mock;
  };
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: MockPrismaService;

  const mockPrismaService = (): MockPrismaService => ({
    category: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    raffle: {
      count: jest.fn(),
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const input = {
        nombre: 'Tecnologia',
        descripcion: 'Productos tecnologicos',
        icono: 'laptop',
        orden: 1,
      };

      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: 'cat-1',
        ...input,
        isActive: true,
      });

      const result = await service.create(input);

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { nombre: 'Tecnologia' },
      });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          nombre: 'Tecnologia',
          descripcion: 'Productos tecnologicos',
          icono: 'laptop',
          orden: 1,
        },
      });
      expect(result.id).toBe('cat-1');
    });

    it('should throw ConflictException if category name already exists', async () => {
      const input = {
        nombre: 'Electronica',
        descripcion: 'Test',
        icono: 'laptop',
      };

      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-existing',
        nombre: 'Electronica',
      });

      await expect(service.create(input)).rejects.toThrow(ConflictException);
    });

    it('should set orden to 0 if not provided', async () => {
      const input = {
        nombre: 'Nueva Categoria',
        descripcion: 'Test',
        icono: 'box',
      };

      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: 'cat-2',
        ...input,
        orden: 0,
      });

      await service.create(input);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orden: 0,
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return only active categories by default', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          nombre: 'Electronica',
          isActive: true,
          orden: 1,
        },
        {
          id: 'cat-2',
          nombre: 'Moda',
          isActive: true,
          orden: 2,
        },
      ];

      prisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { orden: 'asc' },
      });
      expect(result).toEqual(mockCategories);
    });

    it('should include inactive categories when requested', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          nombre: 'Electronica',
          isActive: true,
          orden: 1,
        },
        {
          id: 'cat-2',
          nombre: 'Obsoleta',
          isActive: false,
          orden: 99,
        },
      ];

      prisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll(true);

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { orden: 'asc' },
      });
      expect(result).toEqual(mockCategories);
    });
  });

  describe('findOne', () => {
    it('should return category by ID', async () => {
      const mockCategory = {
        id: 'cat-1',
        nombre: 'Electronica',
        descripcion: 'Productos electronicos',
        isActive: true,
      };

      prisma.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne('cat-1');

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update category', async () => {
      const input = {
        descripcion: 'Descripcion actualizada',
        icono: 'new-icon',
      };

      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        nombre: 'Electronica',
      });
      prisma.category.update.mockResolvedValue({
        id: 'cat-1',
        nombre: 'Electronica',
        descripcion: 'Descripcion actualizada',
        icono: 'new-icon',
      });

      const result = await service.update('cat-1', input);

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: input,
      });
      expect(result.descripcion).toBe('Descripcion actualizada');
    });

    it('should check for duplicate name when updating', async () => {
      const input = {
        nombre: 'Moda',
      };

      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        nombre: 'Electronica',
      });
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-2',
        nombre: 'Moda',
      });

      await expect(service.update('cat-1', input)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow updating to same name', async () => {
      const input = {
        nombre: 'Electronica',
        descripcion: 'Updated',
      };

      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        nombre: 'Electronica',
      });
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.update.mockResolvedValue({
        id: 'cat-1',
        nombre: 'Electronica',
        descripcion: 'Updated',
      });

      const result = await service.update('cat-1', input);

      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should hard delete category with no raffles', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        nombre: 'Categoria Vacia',
      });
      prisma.raffle.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue({
        id: 'cat-1',
      });

      const result = await service.delete('cat-1');

      expect(prisma.raffle.count).toHaveBeenCalledWith({
        where: { categoryId: 'cat-1' },
      });
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
      expect(result).toBe(true);
    });

    it('should soft delete category with raffles', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        nombre: 'Categoria Con Rifas',
      });
      prisma.raffle.count.mockResolvedValue(5);
      prisma.category.update.mockResolvedValue({
        id: 'cat-1',
        isActive: false,
      });

      const result = await service.delete('cat-1');

      expect(prisma.raffle.count).toHaveBeenCalled();
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { isActive: false },
      });
      expect(prisma.category.delete).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.delete('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('seedDefaultCategories', () => {
    it('should seed 7 default categories', async () => {
      prisma.category.upsert.mockResolvedValue({});

      await service.seedDefaultCategories();

      expect(prisma.category.upsert).toHaveBeenCalledTimes(7);
      expect(prisma.category.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nombre: 'Electronica' },
          create: expect.objectContaining({
            nombre: 'Electronica',
            icono: 'laptop',
            orden: 1,
          }),
        }),
      );
    });
  });
});
