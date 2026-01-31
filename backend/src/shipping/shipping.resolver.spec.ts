import { Test, TestingModule } from '@nestjs/testing';
import { ShippingResolver } from './shipping.resolver';
import { ShippingService } from './shipping.service';

type MockShippingService = {
  findAll: jest.Mock;
  getDefault: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  setDefault: jest.Mock;
};

describe('ShippingResolver', () => {
  let resolver: ShippingResolver;
  let service: MockShippingService;

  const mockShippingService = (): MockShippingService => ({
    findAll: jest.fn(),
    getDefault: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setDefault: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingResolver,
        { provide: ShippingService, useValue: mockShippingService() },
      ],
    }).compile();

    resolver = module.get<ShippingResolver>(ShippingResolver);
    service = module.get(ShippingService) as unknown as MockShippingService;
  });

  describe('myShippingAddresses', () => {
    it('should return all user shipping addresses', async () => {
      const mockAddresses = [
        {
          id: 'addr-1',
          userId: 'user-1',
          label: 'Casa',
          recipientName: 'Juan Pérez',
          street: 'Av. Corrientes',
          number: '1234',
          city: 'CABA',
          province: 'Buenos Aires',
          postalCode: '1043',
          isDefault: true,
        },
        {
          id: 'addr-2',
          userId: 'user-1',
          label: 'Trabajo',
          recipientName: 'Juan Pérez',
          street: 'Av. Santa Fe',
          number: '5678',
          city: 'CABA',
          province: 'Buenos Aires',
          postalCode: '1425',
          isDefault: false,
        },
      ];

      service.findAll.mockResolvedValue(mockAddresses);

      const result = await resolver.myShippingAddresses({ id: 'user-1' });

      expect(service.findAll).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockAddresses);
      expect(result).toHaveLength(2);
    });
  });

  describe('myDefaultShippingAddress', () => {
    it('should return default shipping address', async () => {
      const mockAddress = {
        id: 'addr-1',
        userId: 'user-1',
        label: 'Casa',
        recipientName: 'Juan Pérez',
        street: 'Av. Corrientes',
        number: '1234',
        isDefault: true,
      };

      service.getDefault.mockResolvedValue(mockAddress);

      const result = await resolver.myDefaultShippingAddress({ id: 'user-1' });

      expect(service.getDefault).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockAddress);
    });

    it('should return null if no default address exists', async () => {
      service.getDefault.mockResolvedValue(null);

      const result = await resolver.myDefaultShippingAddress({ id: 'user-1' });

      expect(result).toBeNull();
    });
  });

  describe('shippingAddress', () => {
    it('should return specific shipping address by ID', async () => {
      const mockAddress = {
        id: 'addr-1',
        userId: 'user-1',
        label: 'Casa',
        recipientName: 'Juan Pérez',
        street: 'Av. Corrientes',
        number: '1234',
      };

      service.findOne.mockResolvedValue(mockAddress);

      const result = await resolver.shippingAddress({ id: 'user-1' }, 'addr-1');

      expect(service.findOne).toHaveBeenCalledWith('user-1', 'addr-1');
      expect(result).toEqual(mockAddress);
    });
  });

  describe('createShippingAddress', () => {
    it('should create new shipping address', async () => {
      const input = {
        recipientName: 'Juan Pérez',
        street: 'Av. Corrientes',
        number: '1234',
        city: 'CABA',
        province: 'Buenos Aires',
        postalCode: '1043',
      };

      const mockCreated = {
        id: 'addr-new',
        userId: 'user-1',
        ...input,
        isDefault: false,
      };

      service.create.mockResolvedValue(mockCreated);

      const result = await resolver.createShippingAddress(
        { id: 'user-1' },
        input,
      );

      expect(service.create).toHaveBeenCalledWith('user-1', input);
      expect(result).toEqual(mockCreated);
    });
  });

  describe('updateShippingAddress', () => {
    it('should update shipping address', async () => {
      const input = {
        label: 'Casa Actualizada',
        number: '4321',
      };

      const mockUpdated = {
        id: 'addr-1',
        userId: 'user-1',
        label: 'Casa Actualizada',
        street: 'Av. Corrientes',
        number: '4321',
      };

      service.update.mockResolvedValue(mockUpdated);

      const result = await resolver.updateShippingAddress(
        { id: 'user-1' },
        'addr-1',
        input,
      );

      expect(service.update).toHaveBeenCalledWith('user-1', 'addr-1', input);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('deleteShippingAddress', () => {
    it('should delete shipping address', async () => {
      service.delete.mockResolvedValue(true);

      const result = await resolver.deleteShippingAddress(
        { id: 'user-1' },
        'addr-1',
      );

      expect(service.delete).toHaveBeenCalledWith('user-1', 'addr-1');
      expect(result).toBe(true);
    });
  });

  describe('setDefaultShippingAddress', () => {
    it('should set address as default', async () => {
      service.setDefault.mockResolvedValue(true);

      const result = await resolver.setDefaultShippingAddress(
        { id: 'user-1' },
        'addr-2',
      );

      expect(service.setDefault).toHaveBeenCalledWith('user-1', 'addr-2');
      expect(result).toBe(true);
    });
  });
});
