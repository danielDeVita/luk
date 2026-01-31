import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from './shipping.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

type MockPrismaService = {
  shippingAddress: {
    count: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };
};

describe('ShippingService', () => {
  let service: ShippingService;
  let prisma: MockPrismaService;

  const mockPrismaService = (): MockPrismaService => ({
    shippingAddress: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: PrismaService, useValue: mockPrismaService() },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
    prisma = module.get(PrismaService) as unknown as MockPrismaService;
  });

  describe('create', () => {
    it('should create shipping address', async () => {
      const input = {
        recipientName: 'Juan Pérez',
        street: 'Av. Corrientes',
        number: '1234',
        city: 'CABA',
        province: 'Buenos Aires',
        postalCode: '1043',
      };

      prisma.shippingAddress.count.mockResolvedValue(0);
      prisma.shippingAddress.updateMany.mockResolvedValue({ count: 0 });
      prisma.shippingAddress.create.mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
        ...input,
        label: 'Principal',
        country: 'Argentina',
        isDefault: true,
      });

      const result = await service.create('user-1', input);

      expect(prisma.shippingAddress.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result.isDefault).toBe(true);
    });

    it('should throw BadRequestException if max addresses reached', async () => {
      prisma.shippingAddress.count.mockResolvedValue(5);

      const input = {
        recipientName: 'Test',
        street: 'Test St',
        number: '123',
        city: 'Test City',
        province: 'Test Province',
        postalCode: '1234',
      };

      await expect(service.create('user-1', input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should set first address as default automatically', async () => {
      const input = {
        recipientName: 'Juan Pérez',
        street: 'Av. Corrientes',
        number: '1234',
        city: 'CABA',
        province: 'Buenos Aires',
        postalCode: '1043',
      };

      prisma.shippingAddress.count.mockResolvedValue(0);
      prisma.shippingAddress.updateMany.mockResolvedValue({ count: 0 });
      prisma.shippingAddress.create.mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
        ...input,
        isDefault: true,
      });

      await service.create('user-1', input);

      expect(prisma.shippingAddress.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isDefault: true,
        }),
      });
    });

    it('should unset other defaults when creating new default address', async () => {
      const input = {
        recipientName: 'Test',
        street: 'Test',
        number: '123',
        city: 'City',
        province: 'Province',
        postalCode: '1234',
        isDefault: true,
      };

      prisma.shippingAddress.count.mockResolvedValue(2);
      prisma.shippingAddress.updateMany.mockResolvedValue({ count: 1 });
      prisma.shippingAddress.create.mockResolvedValue({
        id: 'addr-3',
        userId: 'user-1',
        ...input,
      });

      await service.create('user-1', input);

      expect(prisma.shippingAddress.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('findAll', () => {
    it('should return all user addresses ordered by default first', async () => {
      const mockAddresses = [
        {
          id: 'addr-1',
          userId: 'user-1',
          label: 'Casa',
          isDefault: true,
        },
        {
          id: 'addr-2',
          userId: 'user-1',
          label: 'Trabajo',
          isDefault: false,
        },
      ];

      prisma.shippingAddress.findMany.mockResolvedValue(mockAddresses);

      const result = await service.findAll('user-1');

      expect(prisma.shippingAddress.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toEqual(mockAddresses);
    });
  });

  describe('findOne', () => {
    it('should return address if user owns it', async () => {
      const mockAddress = {
        id: 'addr-1',
        userId: 'user-1',
        label: 'Casa',
      };

      prisma.shippingAddress.findFirst.mockResolvedValue(mockAddress);

      const result = await service.findOne('user-1', 'addr-1');

      expect(prisma.shippingAddress.findFirst).toHaveBeenCalledWith({
        where: { id: 'addr-1', userId: 'user-1' },
      });
      expect(result).toEqual(mockAddress);
    });

    it('should throw NotFoundException if address not found or not owned', async () => {
      prisma.shippingAddress.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'addr-other')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDefault', () => {
    it('should return default address', async () => {
      const mockAddress = {
        id: 'addr-1',
        userId: 'user-1',
        isDefault: true,
      };

      prisma.shippingAddress.findFirst.mockResolvedValue(mockAddress);

      const result = await service.getDefault('user-1');

      expect(prisma.shippingAddress.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', isDefault: true },
      });
      expect(result).toEqual(mockAddress);
    });

    it('should return null if no default address', async () => {
      prisma.shippingAddress.findFirst.mockResolvedValue(null);

      const result = await service.getDefault('user-1');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update shipping address', async () => {
      const input = {
        label: 'Casa Actualizada',
        phone: '123456789',
      };

      prisma.shippingAddress.findFirst.mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
        isDefault: false,
      });
      prisma.shippingAddress.update.mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
        ...input,
      });

      const result = await service.update('user-1', 'addr-1', input);

      expect(prisma.shippingAddress.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: input,
      });
      expect(result).toBeDefined();
    });

    it('should unset other defaults when updating to default', async () => {
      const input = {
        isDefault: true,
      };

      prisma.shippingAddress.findFirst.mockResolvedValue({
        id: 'addr-2',
        userId: 'user-1',
      });
      prisma.shippingAddress.updateMany.mockResolvedValue({ count: 1 });
      prisma.shippingAddress.update.mockResolvedValue({
        id: 'addr-2',
        isDefault: true,
      });

      await service.update('user-1', 'addr-2', input);

      expect(prisma.shippingAddress.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isDefault: true, id: { not: 'addr-2' } },
        data: { isDefault: false },
      });
    });
  });

  describe('delete', () => {
    it('should delete non-default address', async () => {
      prisma.shippingAddress.findFirst.mockResolvedValue({
        id: 'addr-1',
        userId: 'user-1',
        isDefault: false,
      });
      prisma.shippingAddress.delete.mockResolvedValue({});

      const result = await service.delete('user-1', 'addr-1');

      expect(prisma.shippingAddress.delete).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
      });
      expect(result).toBe(true);
    });

    it('should reassign default when deleting default address', async () => {
      prisma.shippingAddress.findFirst
        .mockResolvedValueOnce({
          id: 'addr-1',
          userId: 'user-1',
          isDefault: true,
        })
        .mockResolvedValueOnce({
          id: 'addr-2',
          userId: 'user-1',
        });
      prisma.shippingAddress.delete.mockResolvedValue({});
      prisma.shippingAddress.update.mockResolvedValue({
        id: 'addr-2',
        isDefault: true,
      });

      await service.delete('user-1', 'addr-1');

      expect(prisma.shippingAddress.update).toHaveBeenCalledWith({
        where: { id: 'addr-2' },
        data: { isDefault: true },
      });
    });

    it('should not reassign default if no other addresses exist', async () => {
      prisma.shippingAddress.findFirst
        .mockResolvedValueOnce({
          id: 'addr-1',
          userId: 'user-1',
          isDefault: true,
        })
        .mockResolvedValueOnce(null);
      prisma.shippingAddress.delete.mockResolvedValue({});

      await service.delete('user-1', 'addr-1');

      expect(prisma.shippingAddress.update).not.toHaveBeenCalled();
    });
  });

  describe('setDefault', () => {
    it('should set address as default', async () => {
      prisma.shippingAddress.findFirst.mockResolvedValue({
        id: 'addr-2',
        userId: 'user-1',
      });
      prisma.shippingAddress.updateMany.mockResolvedValue({ count: 1 });
      prisma.shippingAddress.update.mockResolvedValue({
        id: 'addr-2',
        isDefault: true,
      });

      const result = await service.setDefault('user-1', 'addr-2');

      expect(prisma.shippingAddress.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.shippingAddress.update).toHaveBeenCalledWith({
        where: { id: 'addr-2' },
        data: { isDefault: true },
      });
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if address not found', async () => {
      prisma.shippingAddress.findFirst.mockResolvedValue(null);

      await expect(service.setDefault('user-1', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
