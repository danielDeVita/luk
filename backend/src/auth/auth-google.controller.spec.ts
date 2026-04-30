import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { AuthGoogleController } from './auth-google.controller';
import { AuthService } from './auth.service';
import { User } from '@prisma/client';

jest.mock('otplib', () => ({
  generateSecret: jest.fn(() => 'SECRET123'),
  generateURI: jest.fn(
    () => 'otpauth://totp/LUK:test@example.com?secret=SECRET123',
  ),
  verifySync: jest.fn(({ token }: { token: string }) => ({
    valid: token === '123456',
    delta: token === '123456' ? 0 : null,
  })),
}));

type MockAuthService = {
  generateTokenForUser: jest.Mock;
  refreshAccessToken: jest.Mock;
  revokeRefreshToken: jest.Mock;
};

type MockConfigService = {
  get: jest.Mock;
};

describe('AuthGoogleController', () => {
  let controller: AuthGoogleController;
  let authService: MockAuthService;
  let _configService: MockConfigService;

  const mockAuthService = (): MockAuthService => ({
    generateTokenForUser: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  });

  const mockConfigService = (
    env: 'production' | 'development' = 'development',
  ): MockConfigService => ({
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'NODE_ENV') return env;
      return null;
    }),
  });

  const mockResponse = () => {
    const res = {} as Response;
    res.redirect = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockRequest = (
    options: {
      user?: Partial<User>;
      cookies?: Record<string, string>;
      headers?: Record<string, string>;
      ip?: string;
    } = {},
  ) => {
    return {
      user: options.user,
      cookies: options.cookies || {},
      headers: options.headers || {},
      ip: options.ip || '203.0.113.10',
    } as any;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('googleAuthCallback', () => {
    it('should redirect without tokens in URL and set httpOnly cookies', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AuthGoogleController],
        providers: [
          { provide: AuthService, useValue: mockAuthService() },
          {
            provide: ConfigService,
            useValue: mockConfigService('development'),
          },
        ],
      }).compile();

      controller = module.get<AuthGoogleController>(AuthGoogleController);
      authService = module.get(AuthService) as unknown as MockAuthService;

      const mockUser = { id: 'user-123', email: 'test@example.com' } as User;
      const req = mockRequest({ user: mockUser });
      const res = mockResponse();

      authService.generateTokenForUser.mockResolvedValue({
        token: 'access-token-123',
        refreshToken: 'refresh-token-123',
      });

      await controller.googleAuthCallback(req, res);

      expect(authService.generateTokenForUser).toHaveBeenCalledWith(
        mockUser,
        'google',
        '203.0.113.10',
      );

      // Check access token cookie
      expect(res.cookie).toHaveBeenCalledWith(
        'auth_token',
        'access-token-123',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'lax', // development mode
          maxAge: 15 * 60 * 1000,
          path: '/',
        },
      );

      // Check refresh token cookie
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token-123',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'lax', // development mode
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/auth',
        },
      );

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/callback?success=true',
      );
    });

    it('should use secure cookies in production', async () => {
      const originalCi = process.env.CI;

      delete process.env.CI;

      try {
        const module: TestingModule = await Test.createTestingModule({
          controllers: [AuthGoogleController],
          providers: [
            { provide: AuthService, useValue: mockAuthService() },
            {
              provide: ConfigService,
              useValue: mockConfigService('production'),
            },
          ],
        }).compile();

        controller = module.get<AuthGoogleController>(AuthGoogleController);
        authService = module.get(AuthService) as unknown as MockAuthService;

        const mockUser = { id: 'user-123', email: 'test@example.com' } as User;
        const req = mockRequest({ user: mockUser });
        const res = mockResponse();

        authService.generateTokenForUser.mockResolvedValue({
          token: 'access-token-123',
          refreshToken: 'refresh-token-123',
        });

        await controller.googleAuthCallback(req, res);

        expect(res.cookie).toHaveBeenCalledWith(
          'auth_token',
          'access-token-123',
          {
            httpOnly: true,
            secure: true,
            sameSite: 'none', // production mode
            maxAge: 15 * 60 * 1000,
            path: '/',
          },
        );

        expect(res.cookie).toHaveBeenCalledWith(
          'refresh_token',
          'refresh-token-123',
          {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/auth',
          },
        );
      } finally {
        if (originalCi === undefined) {
          delete process.env.CI;
        } else {
          process.env.CI = originalCi;
        }
      }
    });

    it('should redirect to error page when no user', async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AuthGoogleController],
        providers: [
          { provide: AuthService, useValue: mockAuthService() },
          { provide: ConfigService, useValue: mockConfigService() },
        ],
      }).compile();

      controller = module.get<AuthGoogleController>(AuthGoogleController);

      const req = mockRequest(); // No user
      const res = mockResponse();

      await controller.googleAuthCallback(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/login?error=google_auth_failed',
      );
    });
  });

  describe('getTokenFromCookie', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AuthGoogleController],
        providers: [
          { provide: AuthService, useValue: mockAuthService() },
          { provide: ConfigService, useValue: mockConfigService() },
        ],
      }).compile();

      controller = module.get<AuthGoogleController>(AuthGoogleController);
    });

    it('should return token from cookie', () => {
      const req = mockRequest({ cookies: { auth_token: 'token-from-cookie' } });
      const res = mockResponse();

      controller.getTokenFromCookie(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
      expect(res.json).toHaveBeenCalledWith({ token: 'token-from-cookie' });
    });

    it('should return 401 when no token', () => {
      const req = mockRequest();
      const res = mockResponse();

      controller.getTokenFromCookie(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token found' });
    });
  });

  describe('refreshToken', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AuthGoogleController],
        providers: [
          { provide: AuthService, useValue: mockAuthService() },
          { provide: ConfigService, useValue: mockConfigService() },
        ],
      }).compile();

      controller = module.get<AuthGoogleController>(AuthGoogleController);
      authService = module.get(AuthService) as unknown as MockAuthService;
    });

    it('should refresh token from cookie', async () => {
      const req = mockRequest({
        cookies: { refresh_token: 'refresh-token-cookie' },
      });
      const res = mockResponse();

      authService.refreshAccessToken.mockResolvedValue({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      await controller.refreshToken(req, res);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-token-cookie',
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'auth_token',
        'new-access-token',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.any(Object),
      );
      expect(res.json).toHaveBeenCalledWith({
        token: 'new-access-token',
      });
    });

    it('should reject refresh requests without the refresh-token cookie', async () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer refresh-token-header' },
      });
      const res = mockResponse();

      await controller.refreshToken(req, res);

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No refresh token found',
      });
    });

    it('should return 401 when no refresh token', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await controller.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No refresh token found',
      });
    });

    it('should return 401 and clear cookies on invalid token', async () => {
      const req = mockRequest({ cookies: { refresh_token: 'invalid-token' } });
      const res = mockResponse();

      authService.refreshAccessToken.mockRejectedValue(
        new Error('Invalid token'),
      );

      await controller.refreshToken(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/auth',
      });
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired refresh token',
      });
    });
  });

  describe('logout', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AuthGoogleController],
        providers: [
          { provide: AuthService, useValue: mockAuthService() },
          { provide: ConfigService, useValue: mockConfigService() },
        ],
      }).compile();

      controller = module.get<AuthGoogleController>(AuthGoogleController);
      authService = module.get(AuthService) as unknown as MockAuthService;
    });

    it('should revoke token and clear cookies', async () => {
      const req = mockRequest({
        cookies: { refresh_token: 'token-to-revoke' },
      });
      const res = mockResponse();

      authService.revokeRefreshToken.mockResolvedValue(undefined);

      await controller.logout(req, res);

      expect(authService.revokeRefreshToken).toHaveBeenCalledWith(
        'token-to-revoke',
      );
      expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/auth',
      });
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should succeed even if token revocation fails', async () => {
      const req = mockRequest({
        cookies: { refresh_token: 'token-to-revoke' },
      });
      const res = mockResponse();

      authService.revokeRefreshToken.mockRejectedValue(
        new Error('Token already revoked'),
      );

      await controller.logout(req, res);

      // Should still clear cookies and return success
      expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/auth',
      });
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should succeed even if no refresh token exists', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await controller.logout(req, res);

      expect(authService.revokeRefreshToken).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('auth_token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/auth',
      });
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
