import { Test, TestingModule } from '@nestjs/testing';
import { MpConnectService } from './mp-connect.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { BadRequestException } from '@nestjs/common';

// Mock global fetch
global.fetch = jest.fn();

describe('MpConnectService', () => {
  let service: MpConnectService;
  let _configService: jest.Mocked<ConfigService>;
  let _prisma: jest.Mocked<PrismaService>;
  let encryption: jest.Mocked<EncryptionService>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        MP_CLIENT_ID: 'test-client-id',
        MP_CLIENT_SECRET: 'test-client-secret',
        BACKEND_URL: 'http://localhost:3001',
      };
      return config[key];
    }),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn((value: string) => `encrypted_${value}`),
    decrypt: jest.fn((value: string) => value.replace('encrypted_', '')),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();

    // Reset mock implementations to default behavior
    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        MP_CLIENT_ID: 'test-client-id',
        MP_CLIENT_SECRET: 'test-client-secret',
        BACKEND_URL: 'http://localhost:3001',
      };
      return config[key];
    });

    mockEncryptionService.encrypt.mockImplementation(
      (value: string) => `encrypted_${value}`,
    );
    mockEncryptionService.decrypt.mockImplementation((value: string) =>
      value.replace('encrypted_', ''),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MpConnectService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<MpConnectService>(MpConnectService);
    _configService = module.get(ConfigService);
    _prisma = module.get(PrismaService);
    encryption = module.get(EncryptionService);
  });

  describe('generateAuthUrl', () => {
    it('should generate a valid MP OAuth URL with PKCE', () => {
      const userId = 'user-123';
      const result = service.generateAuthUrl(userId);

      expect(result.authUrl).toContain(
        'https://auth.mercadopago.com/authorization',
      );
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain('response_type=code');
      expect(result.authUrl).toContain('platform_id=mp');
      expect(result.authUrl).toContain('redirect_uri=');
      expect(result.authUrl).toContain('code_challenge=');
      expect(result.authUrl).toContain('code_challenge_method=S256');
      expect(result.state).toBeDefined();
      expect(result.state.length).toBe(64); // 32 bytes in hex
    });

    it('should include correct redirect URI', () => {
      const result = service.generateAuthUrl('user-123');

      expect(result.authUrl).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fmp%2Fconnect%2Fcallback',
      );
    });

    it('should generate unique state for each request', () => {
      const result1 = service.generateAuthUrl('user-123');
      const result2 = service.generateAuthUrl('user-123');

      expect(result1.state).not.toBe(result2.state);
    });

    it('should throw BadRequestException if MP_CLIENT_ID is not configured', () => {
      mockConfigService.get.mockReturnValue(undefined as any);

      expect(() => service.generateAuthUrl('user-123')).toThrow(
        BadRequestException,
      );
      expect(() => service.generateAuthUrl('user-123')).toThrow(
        'MP_CLIENT_ID no está configurado',
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    const mockTokenResponse = {
      access_token: 'mp-access-token',
      token_type: 'Bearer',
      expires_in: 15552000,
      scope: 'offline_access read write',
      user_id: 123456789,
      refresh_token: 'mp-refresh-token',
      public_key: 'APP_USR-public-key',
    };

    beforeEach(() => {
      // Setup a valid PKCE verifier by generating an auth URL first
      service.generateAuthUrl('user-123');
    });

    it('should successfully exchange code for tokens', async () => {
      const { state } = service.generateAuthUrl('user-123');
      const code = 'auth-code-123';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      });

      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-123',
        mpUserId: '123456789',
        mpConnectStatus: 'CONNECTED',
      });

      const result = await service.exchangeCodeForTokens(code, state);

      expect(result.userId).toBe('user-123');
      expect(result.mpUserId).toBe('123456789');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('should encrypt tokens before storing', async () => {
      const { state } = service.generateAuthUrl('user-123');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      });

      mockPrismaService.user.update.mockResolvedValue({});

      await service.exchangeCodeForTokens('code', state);

      expect(encryption.encrypt).toHaveBeenCalledWith('mp-access-token');
      expect(encryption.encrypt).toHaveBeenCalledWith('mp-refresh-token');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          mpAccessToken: 'encrypted_mp-access-token',
          mpRefreshToken: 'encrypted_mp-refresh-token',
          mpUserId: '123456789',
          mpConnectStatus: 'CONNECTED',
        }),
      });
    });

    it('should throw BadRequestException for invalid state', async () => {
      const invalidState = 'invalid-state-123';

      await expect(
        service.exchangeCodeForTokens('code', invalidState),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.exchangeCodeForTokens('code', invalidState),
      ).rejects.toThrow('Estado inválido o expirado');
    });

    it('should throw BadRequestException if MP credentials not configured', async () => {
      const { state } = service.generateAuthUrl('user-123');
      mockConfigService.get.mockReturnValue(undefined as any);

      await expect(
        service.exchangeCodeForTokens('code', state),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.exchangeCodeForTokens('code', state),
      ).rejects.toThrow(
        'MP_CLIENT_ID o MP_CLIENT_SECRET no están configurados',
      );
    });

    it('should throw BadRequestException if MP API returns error', async () => {
      const { state } = service.generateAuthUrl('user-123');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid authorization code' }),
      });

      await expect(
        service.exchangeCodeForTokens('code', state),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use PKCE verifier one-time only', async () => {
      const { state } = service.generateAuthUrl('user-123');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      });

      mockPrismaService.user.update.mockResolvedValue({});

      // First use should succeed
      await service.exchangeCodeForTokens('code', state);

      // Second use with same state should fail
      await expect(
        service.exchangeCodeForTokens('code', state),
      ).rejects.toThrow('Estado inválido o expirado');
    });
  });

  describe('refreshAccessToken', () => {
    const mockRefreshResponse = {
      access_token: 'new-access-token',
      token_type: 'Bearer',
      expires_in: 15552000,
      scope: 'offline_access read write',
      user_id: 123456789,
      refresh_token: 'new-refresh-token',
      public_key: 'APP_USR-public-key',
    };

    it('should successfully refresh access token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        mpRefreshToken: 'encrypted_old-refresh-token',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRefreshResponse,
      });

      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.refreshAccessToken('user-123');

      expect(result).toBe(true);
      expect(encryption.decrypt).toHaveBeenCalledWith(
        'encrypted_old-refresh-token',
      );
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          mpAccessToken: 'encrypted_new-access-token',
          mpRefreshToken: 'encrypted_new-refresh-token',
        }),
      });
    });

    it('should return false if user has no refresh token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        mpRefreshToken: null,
      });

      const result = await service.refreshAccessToken('user-123');

      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return false if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.refreshAccessToken('user-123');

      expect(result).toBe(false);
    });

    it('should return false if decryption fails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        mpRefreshToken: 'encrypted_token',
      });

      mockEncryptionService.decrypt.mockReturnValue(null as any);

      const result = await service.refreshAccessToken('user-123');

      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should mark user as disconnected if refresh fails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        mpRefreshToken: 'encrypted_old-refresh-token',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid refresh token' }),
      });

      const result = await service.refreshAccessToken('user-123');

      expect(result).toBe(false);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { mpConnectStatus: 'NOT_CONNECTED' },
      });
    });

    it('should call MP API with correct parameters', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        mpRefreshToken: 'encrypted_refresh-token',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRefreshResponse,
      });

      mockPrismaService.user.update.mockResolvedValue({});

      await service.refreshAccessToken('user-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mercadopago.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = fetchCall[1].body;
      expect(body).toContain('grant_type=refresh_token');
      expect(body).toContain('refresh_token=refresh-token'); // Decrypted value
    });
  });

  describe('disconnect', () => {
    it('should clear MP credentials from user', async () => {
      mockPrismaService.user.update.mockResolvedValue({
        id: 'user-123',
        mpUserId: null,
        mpAccessToken: null,
        mpRefreshToken: null,
        mpConnectStatus: 'NOT_CONNECTED',
      });

      await service.disconnect('user-123');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          mpUserId: null,
          mpAccessToken: null,
          mpRefreshToken: null,
          mpConnectStatus: 'NOT_CONNECTED',
        },
      });
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connected status when user is connected', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        mpConnectStatus: 'CONNECTED',
        mpUserId: '123456789',
      });

      const result = await service.getConnectionStatus('user-123');

      expect(result.connected).toBe(true);
      expect(result.mpUserId).toBe('123456789');
    });

    it('should return disconnected status when user is not connected', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        mpConnectStatus: 'NOT_CONNECTED',
        mpUserId: null,
      });

      const result = await service.getConnectionStatus('user-123');

      expect(result.connected).toBe(false);
      expect(result.mpUserId).toBeNull();
    });

    it('should return disconnected if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getConnectionStatus('user-123');

      expect(result.connected).toBe(false);
      expect(result.mpUserId).toBeNull();
    });
  });

  describe('PKCE flow', () => {
    it('should generate different code challenges for different verifiers', () => {
      const result1 = service.generateAuthUrl('user-1');
      const result2 = service.generateAuthUrl('user-2');

      // Extract code_challenge from URLs
      const challenge1 = new URL(result1.authUrl).searchParams.get(
        'code_challenge',
      );
      const challenge2 = new URL(result2.authUrl).searchParams.get(
        'code_challenge',
      );

      expect(challenge1).toBeDefined();
      expect(challenge2).toBeDefined();
      expect(challenge1).not.toBe(challenge2);
    });

    it('should use S256 code challenge method', () => {
      const result = service.generateAuthUrl('user-123');

      expect(result.authUrl).toContain('code_challenge_method=S256');
    });
  });
});
