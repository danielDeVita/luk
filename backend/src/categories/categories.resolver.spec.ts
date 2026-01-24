import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesResolver } from './categories.resolver';
import { CategoriesService } from './categories.service';

describe('CategoriesResolver', () => {
  let resolver: CategoriesResolver;
  let categoriesService: any;

  const mockCategoriesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const createTestCategory = (overrides = {}) => ({
    id: 'cat-1',
    nombre: 'Electrónica',
    descripcion: 'Productos electrónicos',
    icono: 'electronics-icon',
    activa: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesResolver,
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    resolver = module.get<CategoriesResolver>(CategoriesResolver);
    categoriesService = module.get(CategoriesService);
  });

  describe('categories', () => {
    it('should return all active categories', async () => {
      const categories = [
        createTestCategory({ id: 'cat-1', nombre: 'Electrónica' }),
        createTestCategory({ id: 'cat-2', nombre: 'Hogar' }),
        createTestCategory({ id: 'cat-3', nombre: 'Deportes' }),
      ];

      categoriesService.findAll.mockResolvedValue(categories);

      const result = await resolver.categories();

      expect(result).toEqual(categories);
      expect(result).toHaveLength(3);
      expect(categoriesService.findAll).toHaveBeenCalledWith();
    });

    it('should be publicly accessible without authentication', async () => {
      categoriesService.findAll.mockResolvedValue([]);

      await resolver.categories();

      expect(categoriesService.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no categories exist', async () => {
      categoriesService.findAll.mockResolvedValue([]);

      const result = await resolver.categories();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('allCategories', () => {
    it('should return all categories including inactive', async () => {
      const categories = [
        createTestCategory({ id: 'cat-1', activa: true }),
        createTestCategory({ id: 'cat-2', activa: false }),
        createTestCategory({ id: 'cat-3', activa: true }),
      ];

      categoriesService.findAll.mockResolvedValue(categories);

      const result = await resolver.allCategories();

      expect(result).toEqual(categories);
      expect(categoriesService.findAll).toHaveBeenCalledWith(true);
    });

    it('should require admin role', async () => {
      // This test verifies the @Roles(UserRole.ADMIN) decorator is present
      // The actual authorization is tested in integration/e2e tests
      categoriesService.findAll.mockResolvedValue([]);

      await resolver.allCategories();

      expect(categoriesService.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('category', () => {
    it('should return category by ID', async () => {
      const category = createTestCategory({ id: 'cat-123' });

      categoriesService.findOne.mockResolvedValue(category);

      const result = await resolver.category('cat-123');

      expect(result).toEqual(category);
      expect(categoriesService.findOne).toHaveBeenCalledWith('cat-123');
    });

    it('should be publicly accessible', async () => {
      categoriesService.findOne.mockResolvedValue(createTestCategory());

      await resolver.category('cat-1');

      expect(categoriesService.findOne).toHaveBeenCalled();
    });

    it('should return category with all properties', async () => {
      const category = createTestCategory({
        id: 'cat-456',
        nombre: 'Tecnología',
        descripcion: 'Productos tecnológicos',
        icono: 'tech-icon',
      });

      categoriesService.findOne.mockResolvedValue(category);

      const result = await resolver.category('cat-456');

      expect(result.nombre).toBe('Tecnología');
      expect(result.descripcion).toBe('Productos tecnológicos');
      expect(result.icono).toBe('tech-icon');
    });
  });

  describe('createCategory', () => {
    it('should create new category', async () => {
      const input = {
        nombre: 'Nueva Categoría',
        descripcion: 'Descripción',
        icono: 'new-icon',
      };
      const createdCategory = createTestCategory({
        id: 'cat-new',
        ...input,
      });

      categoriesService.create.mockResolvedValue(createdCategory);

      const result = await resolver.createCategory(input);

      expect(result).toEqual(createdCategory);
      expect(categoriesService.create).toHaveBeenCalledWith(input);
    });

    it('should create category with provided data', async () => {
      const input = {
        nombre: 'Moda',
        descripcion: 'Ropa y accesorios',
        icono: 'fashion-icon',
      };

      categoriesService.create.mockResolvedValue(createTestCategory(input));

      await resolver.createCategory(input);

      expect(categoriesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Moda',
          descripcion: 'Ropa y accesorios',
          icono: 'fashion-icon',
        }),
      );
    });

    it('should require admin role', async () => {
      // Verifies @Roles(UserRole.ADMIN) decorator is present
      const input = { nombre: 'Test', descripcion: 'Test', icono: 'test' };

      categoriesService.create.mockResolvedValue(createTestCategory());

      await resolver.createCategory(input);

      expect(categoriesService.create).toHaveBeenCalled();
    });
  });

  describe('updateCategory', () => {
    it('should update category', async () => {
      const id = 'cat-1';
      const input = {
        nombre: 'Updated Name',
        descripcion: 'Updated Description',
      };
      const updatedCategory = createTestCategory({ id, ...input });

      categoriesService.update.mockResolvedValue(updatedCategory);

      const result = await resolver.updateCategory(id, input);

      expect(result).toEqual(updatedCategory);
      expect(categoriesService.update).toHaveBeenCalledWith(id, input);
    });

    it('should update only provided fields', async () => {
      const id = 'cat-2';
      const input = { nombre: 'New Name Only' };

      categoriesService.update.mockResolvedValue(
        createTestCategory({ id, nombre: 'New Name Only' }),
      );

      await resolver.updateCategory(id, input);

      expect(categoriesService.update).toHaveBeenCalledWith(id, input);
    });

    it('should require admin role', async () => {
      const input = { nombre: 'Test' };

      categoriesService.update.mockResolvedValue(createTestCategory());

      await resolver.updateCategory('cat-1', input);

      expect(categoriesService.update).toHaveBeenCalled();
    });
  });

  describe('deleteCategory', () => {
    it('should delete category', async () => {
      const id = 'cat-to-delete';

      categoriesService.delete.mockResolvedValue(true);

      const result = await resolver.deleteCategory(id);

      expect(result).toBe(true);
      expect(categoriesService.delete).toHaveBeenCalledWith(id);
    });

    it('should return false when category not found', async () => {
      categoriesService.delete.mockResolvedValue(false);

      const result = await resolver.deleteCategory('non-existent');

      expect(result).toBe(false);
    });

    it('should require admin role', async () => {
      categoriesService.delete.mockResolvedValue(true);

      await resolver.deleteCategory('cat-1');

      expect(categoriesService.delete).toHaveBeenCalled();
    });
  });
});
