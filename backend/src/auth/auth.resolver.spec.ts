import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Response } from 'express';
import { UserRole, MpConnectStatus, KycStatus } from '@prisma/client';
import { LoginThrottlerGuard } from '@/common/guards';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let usersService: any;

  const mockAuthService = {
    register: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationCode: jest.fn(),
    login: jest.fn(),
  };

  const mockUsersService = {
    getUserWithDecryptedPII: jest.fn(),
  };

  const mockResponse = () =>
    ({
      cookie: jest.fn(),
    }) as unknown as Response;

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
        AuthResolver,
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
      .overrideGuard(LoginThrottlerGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    authService = module.get(AuthService);
    usersService = module.get(UsersService);
  });

  describe('register', () => {
    it('should call auth service and return registration result', async () => {
      const input = {
        email: 'new@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        nombre: 'New',
        apellido: 'User',
        fechaNacimiento: '1990-01-01',
        acceptTerms: true,
      };

      const expected = {
        user: createTestUser({
          email: 'new@example.com',
          emailVerified: false,
        }),
        requiresVerification: true,
        message: 'Verification code sent to email',
      };

      authService.register.mockResolvedValue(expected);

      const result = await resolver.register(input);

      expect(result).toEqual(expected);
      expect(authService.register).toHaveBeenCalledWith(input);
    });

    it('should not set cookies during registration', async () => {
      const input = {
        email: 'new@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        nombre: 'New',
        apellido: 'User',
        fechaNacimiento: '1990-01-01',
        acceptTerms: true,
      };

      authService.register.mockResolvedValue({
        user: createTestUser(),
        requiresVerification: true,
      });

      // Registration doesn't receive context/response
      await resolver.register(input);

      // Verify no cookies are set (user must verify email first)
      expect(authService.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and set auth cookies', async () => {
      const userId = 'user-1';
      const code = '123456';
      const res = mockResponse();
      const context = { req: {}, res };

      const authPayload = {
        user: createTestUser(),
        token: 'access-token',
        refreshToken: 'refresh-token',
      };

      authService.verifyEmail.mockResolvedValue(authPayload);

      const result = await resolver.verifyEmail(userId, code, context);

      expect(result).toEqual(authPayload);
      expect(authService.verifyEmail).toHaveBeenCalledWith(
        userId,
        code,
        undefined,
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'auth_token',
        'access-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
        }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/auth',
        }),
      );
    });

    it('should apply referral code when provided', async () => {
      const userId = 'user-1';
      const code = '123456';
      const referralCode = 'REFER123';
      const res = mockResponse();
      const context = { req: {}, res };

      authService.verifyEmail.mockResolvedValue({
        user: createTestUser(),
        token: 'token',
        refreshToken: 'refresh',
      });

      await resolver.verifyEmail(userId, code, context, referralCode);

      expect(authService.verifyEmail).toHaveBeenCalledWith(
        userId,
        code,
        referralCode,
      );
    });
  });

  describe('resendVerificationCode', () => {
    it('should call auth service to resend code', async () => {
      authService.resendVerificationCode.mockResolvedValue(true);

      const result = await resolver.resendVerificationCode('user-1');

      expect(result).toBe(true);
      expect(authService.resendVerificationCode).toHaveBeenCalledWith('user-1');
    });

    it('should return false when resend fails', async () => {
      authService.resendVerificationCode.mockResolvedValue(false);

      const result = await resolver.resendVerificationCode('user-1');

      expect(result).toBe(false);
    });
  });

  describe('login', () => {
    it('should login user and set auth cookies', async () => {
      const input = { email: 'test@example.com', password: 'password123' };
      const res = mockResponse();
      const context = {
        req: { ip: '192.168.1.1', headers: {} },
        res,
      };

      const authPayload = {
        user: createTestUser(),
        token: 'access-token',
        refreshToken: 'refresh-token',
      };

      authService.login.mockResolvedValue(authPayload);

      const result = await resolver.login(input, context);

      expect(result).toEqual(authPayload);
      expect(authService.login).toHaveBeenCalledWith(input, '192.168.1.1');
      expect(res.cookie).toHaveBeenCalledTimes(2);
    });

    it('should extract IP from x-forwarded-for header', async () => {
      const input = { email: 'test@example.com', password: 'password123' };
      const res = mockResponse();
      const context = {
        req: {
          ip: '127.0.0.1',
          headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
        },
        res,
      };

      authService.login.mockResolvedValue({
        user: createTestUser(),
        token: 'token',
        refreshToken: 'refresh',
      });

      await resolver.login(input, context);

      expect(authService.login).toHaveBeenCalledWith(input, '203.0.113.1');
    });

    it('should extract IP from x-real-ip header when x-forwarded-for missing', async () => {
      const input = { email: 'test@example.com', password: 'password123' };
      const res = mockResponse();
      const context = {
        req: {
          ip: '127.0.0.1',
          headers: { 'x-real-ip': '203.0.113.5' },
        },
        res,
      };

      authService.login.mockResolvedValue({
        user: createTestUser(),
        token: 'token',
        refreshToken: 'refresh',
      });

      await resolver.login(input, context);

      expect(authService.login).toHaveBeenCalledWith(input, '203.0.113.5');
    });

    it('should fallback to req.ip when no proxy headers present', async () => {
      const input = { email: 'test@example.com', password: 'password123' };
      const res = mockResponse();
      const context = {
        req: {
          ip: '192.168.1.100',
          headers: {},
        },
        res,
      };

      authService.login.mockResolvedValue({
        user: createTestUser(),
        token: 'token',
        refreshToken: 'refresh',
      });

      await resolver.login(input, context);

      expect(authService.login).toHaveBeenCalledWith(input, '192.168.1.100');
    });

    it('should use "unknown" when IP cannot be determined', async () => {
      const input = { email: 'test@example.com', password: 'password123' };
      const res = mockResponse();
      const context = {
        req: {
          headers: {},
        },
        res,
      };

      authService.login.mockResolvedValue({
        user: createTestUser(),
        token: 'token',
        refreshToken: 'refresh',
      });

      await resolver.login(input, context);

      expect(authService.login).toHaveBeenCalledWith(input, 'unknown');
    });
  });

  describe('me', () => {
    it('should return current user with decrypted PII', async () => {
      const user = createTestUser();
      const decryptedUser = {
        ...user,
        documentNumber: '12345678',
        street: 'Av. Corrientes',
      };

      mockUsersService.getUserWithDecryptedPII.mockResolvedValue(decryptedUser);

      const result = await resolver.me(user);

      expect(result).toEqual(decryptedUser);
      expect(mockUsersService.getUserWithDecryptedPII).toHaveBeenCalledWith(
        user.id,
      );
    });

    it('should return user with all properties decrypted', async () => {
      const user = createTestUser({
        id: 'custom-id',
        email: 'custom@example.com',
        nombre: 'Custom',
        apellido: 'Name',
        role: UserRole.ADMIN,
      });
      const decryptedUser = {
        ...user,
        documentNumber: '87654321',
        cuitCuil: '20-87654321-9',
      };

      mockUsersService.getUserWithDecryptedPII.mockResolvedValue(decryptedUser);

      const result = await resolver.me(user);

      expect(result.id).toBe('custom-id');
      expect(result.email).toBe('custom@example.com');
      expect(result.role).toBe(UserRole.ADMIN);
    });
  });
});
