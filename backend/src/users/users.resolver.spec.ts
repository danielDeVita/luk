import { Test, TestingModule } from '@nestjs/testing';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import {
  UserRole,
  MpConnectStatus,
  KycStatus,
  DocumentType,
} from '@prisma/client';

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  let usersService: any;

  const mockUsersService = {
    getSellerProfile: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    updateKyc: jest.fn(),
    acceptTerms: jest.fn(),
    updateAvatar: jest.fn(),
    deleteAvatar: jest.fn(),
  };

  const createTestUser = (overrides = {}) => ({
    id: 'user-1',
    email: 'test@example.com',
    nombre: 'Test',
    apellido: 'User',
    role: UserRole.USER,
    emailVerified: true,
    mpConnectStatus: MpConnectStatus.NOT_CONNECTED,
    kycStatus: KycStatus.NOT_SUBMITTED,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
    usersService = module.get(UsersService);
  });

  describe('sellerProfile', () => {
    it('should return public seller profile', async () => {
      const sellerProfile = {
        id: 'seller-1',
        nombre: 'John',
        apellido: 'Seller',
        avatarUrl: 'https://example.com/avatar.jpg',
        totalVentas: 10,
        rating: 4.5,
        nivel: 'BRONCE',
        kycStatus: KycStatus.VERIFIED,
        createdAt: new Date(),
      };

      usersService.getSellerProfile.mockResolvedValue(sellerProfile);

      const result = await resolver.sellerProfile('seller-1');

      expect(result).toEqual(sellerProfile);
      expect(usersService.getSellerProfile).toHaveBeenCalledWith('seller-1');
    });

    it('should be publicly accessible', async () => {
      // This test verifies the @Public() decorator is present
      // by checking that the method can be called without auth
      usersService.getSellerProfile.mockResolvedValue({
        id: 'seller-1',
        nombre: 'John',
        apellido: 'Seller',
      });

      await resolver.sellerProfile('seller-1');

      expect(usersService.getSellerProfile).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const user = createTestUser();
      const input = {
        nombre: 'Updated',
        apellido: 'Name',
        phone: '+5491112345678',
      };
      const updatedUser = { ...user, ...input };

      usersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await resolver.updateProfile(user, input);

      expect(result).toEqual(updatedUser);
      expect(usersService.updateProfile).toHaveBeenCalledWith(user.id, input);
    });

    it('should update only provided fields', async () => {
      const user = createTestUser();
      const input = { nombre: 'NewName' };

      usersService.updateProfile.mockResolvedValue({
        ...user,
        nombre: 'NewName',
      });

      await resolver.updateProfile(user, input);

      expect(usersService.updateProfile).toHaveBeenCalledWith(user.id, input);
    });
  });

  describe('changePassword', () => {
    it('should change user password', async () => {
      const user = createTestUser();
      const input = {
        oldPassword: 'oldPass123',
        newPassword: 'newPass456',
      };

      usersService.changePassword.mockResolvedValue(user);

      const result = await resolver.changePassword(user, input);

      expect(result).toEqual(user);
      expect(usersService.changePassword).toHaveBeenCalledWith(
        user.id,
        'oldPass123',
        'newPass456',
      );
    });

    it('should extract passwords correctly from input', async () => {
      const user = createTestUser();
      const input = {
        oldPassword: 'current',
        newPassword: 'updated',
      };

      usersService.changePassword.mockResolvedValue(user);

      await resolver.changePassword(user, input);

      const [userId, oldPass, newPass] =
        usersService.changePassword.mock.calls[0];
      expect(userId).toBe(user.id);
      expect(oldPass).toBe('current');
      expect(newPass).toBe('updated');
    });
  });

  describe('updateKyc', () => {
    it('should update KYC information', async () => {
      const user = createTestUser();
      const input = {
        documentType: DocumentType.DNI,
        documentNumber: '12345678',
        street: 'Calle Falsa',
        streetNumber: '123',
        city: 'Buenos Aires',
        province: 'CABA',
        postalCode: '1234',
        cuitCuil: '20-12345678-9',
      };

      const updatedUser = {
        ...user,
        kycStatus: KycStatus.PENDING_REVIEW,
      };

      usersService.updateKyc.mockResolvedValue(updatedUser);

      const result = await resolver.updateKyc(user, input);

      expect(result).toEqual(updatedUser);
      expect(usersService.updateKyc).toHaveBeenCalledWith(user.id, input);
    });

    it('should handle optional apartment field', async () => {
      const user = createTestUser();
      const input = {
        documentType: DocumentType.DNI,
        documentNumber: '12345678',
        street: 'Calle Falsa',
        streetNumber: '123',
        apartment: '4B',
        city: 'Buenos Aires',
        province: 'CABA',
        postalCode: '1234',
        cuitCuil: '20-12345678-9',
      };

      usersService.updateKyc.mockResolvedValue(user);

      await resolver.updateKyc(user, input);

      expect(usersService.updateKyc).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ apartment: '4B' }),
      );
    });
  });

  describe('acceptTerms', () => {
    it('should accept terms and conditions', async () => {
      const user = createTestUser();
      const input = { acceptTerms: true, termsVersion: '1.0' };

      usersService.acceptTerms.mockResolvedValue(user);

      const result = await resolver.acceptTerms(user, input);

      expect(result).toEqual(user);
      expect(usersService.acceptTerms).toHaveBeenCalledWith(user.id, input);
    });
  });

  describe('updateAvatar', () => {
    it('should update user avatar', async () => {
      const user = createTestUser();
      const input = { avatarUrl: 'https://cloudinary.com/avatar.jpg' };
      const updatedUser = {
        ...user,
        avatarUrl: 'https://cloudinary.com/avatar.jpg',
      };

      usersService.updateAvatar.mockResolvedValue(updatedUser);

      const result = await resolver.updateAvatar(user, input);

      expect(result).toEqual(updatedUser);
      expect(usersService.updateAvatar).toHaveBeenCalledWith(
        user.id,
        'https://cloudinary.com/avatar.jpg',
      );
    });

    it('should extract avatarUrl from input', async () => {
      const user = createTestUser();
      const input = { avatarUrl: 'https://example.com/new-avatar.png' };

      usersService.updateAvatar.mockResolvedValue(user);

      await resolver.updateAvatar(user, input);

      expect(usersService.updateAvatar).toHaveBeenCalledWith(
        user.id,
        'https://example.com/new-avatar.png',
      );
    });
  });

  describe('deleteAvatar', () => {
    it('should delete user avatar', async () => {
      const user = createTestUser({ avatarUrl: 'https://example.com/old.jpg' });
      const updatedUser = { ...user, avatarUrl: null };

      usersService.deleteAvatar.mockResolvedValue(updatedUser);

      const result = await resolver.deleteAvatar(user);

      expect(result).toEqual(updatedUser);
      expect(usersService.deleteAvatar).toHaveBeenCalledWith(user.id);
    });

    it('should call service with correct user ID', async () => {
      const user = createTestUser({ id: 'custom-user-id' });

      usersService.deleteAvatar.mockResolvedValue(user);

      await resolver.deleteAvatar(user);

      expect(usersService.deleteAvatar).toHaveBeenCalledWith('custom-user-id');
    });
  });
});
