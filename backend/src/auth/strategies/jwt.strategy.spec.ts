import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue('jwt-secret'),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(mockPrisma as never, mockConfigService);
  });

  it('returns verified active users', async () => {
    const user = {
      id: 'user-1',
      email: 'verified@example.com',
      role: UserRole.USER,
      emailVerified: true,
      isDeleted: false,
    };

    mockPrisma.user.findUnique.mockResolvedValue(user as never);

    await expect(
      strategy.validate({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    ).resolves.toEqual(user);
  });

  it('rejects users whose email is not verified', async () => {
    const user = {
      id: 'user-1',
      email: 'pending@example.com',
      role: UserRole.USER,
      emailVerified: false,
      isDeleted: false,
    };

    mockPrisma.user.findUnique.mockResolvedValue(user as never);

    await expect(
      strategy.validate({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      strategy.validate({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    ).rejects.toThrow('Email not verified');
  });
});
