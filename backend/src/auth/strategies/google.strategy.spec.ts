import { ConfigService } from '@nestjs/config';
import { Profile, VerifyCallback } from 'passport-google-oauth20';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:3001/auth/google/callback',
      };

      return config[key];
    }),
  } as unknown as ConfigService;

  const mockNotificationsService = {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  };

  const createProfile = (): Profile =>
    ({
      id: 'google-123',
      displayName: 'Juan Perez',
      emails: [{ value: 'juan@example.com', verified: true }],
      photos: [{ value: 'https://example.com/avatar.png' }],
      provider: 'google',
    }) as Profile;

  const createDone = () =>
    jest.fn() as unknown as jest.MockedFunction<VerifyCallback>;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new GoogleStrategy(
      mockConfigService,
      mockPrisma as never,
      mockNotificationsService as never,
    );
  });

  it('marks newly created Google users as verified', async () => {
    const profile = createProfile();
    const done = createDone();
    const createdUser = {
      id: 'user-1',
      email: 'juan@example.com',
      googleId: 'google-123',
      nombre: 'Juan',
      apellido: 'Perez',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    };

    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(createdUser as never);

    await strategy.validate('access', 'refresh', profile, done);

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'juan@example.com',
        googleId: 'google-123',
        emailVerified: true,
        emailVerifiedAt: expect.any(Date),
      }),
    });
    expect(mockNotificationsService.sendWelcomeEmail).toHaveBeenCalledWith(
      'juan@example.com',
      expect.objectContaining({ userName: 'Juan' }),
    );
    expect(done).toHaveBeenCalledWith(null, createdUser);
  });

  it('marks existing email users as verified when linking Google', async () => {
    const profile = createProfile();
    const done = createDone();
    const existingUser = {
      id: 'user-1',
      email: 'juan@example.com',
      googleId: null,
      avatarUrl: null,
      emailVerified: false,
      emailVerifiedAt: null,
    };
    const linkedUser = {
      ...existingUser,
      googleId: 'google-123',
      avatarUrl: 'https://example.com/avatar.png',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    };

    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(existingUser as never);
    mockPrisma.user.update.mockResolvedValue(linkedUser as never);

    await strategy.validate('access', 'refresh', profile, done);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { email: 'juan@example.com' },
      data: expect.objectContaining({
        googleId: 'google-123',
        emailVerified: true,
        emailVerifiedAt: expect.any(Date),
      }),
    });
    expect(done).toHaveBeenCalledWith(null, linkedUser);
  });

  it('normalizes existing Google-linked users to verified', async () => {
    const profile = createProfile();
    const done = createDone();
    const existingUser = {
      id: 'user-1',
      email: 'juan@example.com',
      googleId: 'google-123',
      emailVerified: false,
      emailVerifiedAt: null,
    };
    const verifiedUser = {
      ...existingUser,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    };

    mockPrisma.user.findFirst.mockResolvedValue(existingUser as never);
    mockPrisma.user.update.mockResolvedValue(verifiedUser as never);

    await strategy.validate('access', 'refresh', profile, done);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: existingUser.id },
      data: expect.objectContaining({
        emailVerified: true,
        emailVerifiedAt: expect.any(Date),
      }),
    });
    expect(done).toHaveBeenCalledWith(null, verifiedUser);
  });
});
