import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response, Request } from 'express';
import { MpConnectController } from './mp-connect.controller';
import { MpConnectService } from './mp-connect.service';

type MockMpConnectService = {
  generateAuthUrl: jest.Mock;
  exchangeCodeForTokens: jest.Mock;
  getConnectionStatus: jest.Mock;
  disconnect: jest.Mock;
};

type MockConfigService = {
  get: jest.Mock;
};

type MockJwtService = {
  verify: jest.Mock;
};

describe('MpConnectController', () => {
  let controller: MpConnectController;
  let mpConnectService: MockMpConnectService;
  let _configService: MockConfigService;
  let jwtService: MockJwtService;

  const mockMpConnectService = (): MockMpConnectService => ({
    generateAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
    getConnectionStatus: jest.fn(),
    disconnect: jest.fn(),
  });

  const mockConfigService = (): MockConfigService => ({
    get: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      return null;
    }),
  });

  const mockJwtService = (): MockJwtService => ({
    verify: jest.fn(),
  });

  const mockResponse = () => {
    const res = {} as Response;
    res.redirect = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockRequest = (
    options: {
      token?: string;
      cookies?: Record<string, string>;
      headers?: Record<string, string>;
    } = {},
  ): Request => {
    return {
      query: options.token ? { token: options.token } : {},
      cookies: options.cookies || {},
      headers: options.headers || {},
    } as unknown as Request;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MpConnectController],
      providers: [
        { provide: MpConnectService, useValue: mockMpConnectService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: JwtService, useValue: mockJwtService() },
      ],
    }).compile();

    controller = module.get<MpConnectController>(MpConnectController);
    mpConnectService = module.get(
      MpConnectService,
    ) as unknown as MockMpConnectService;
    _configService = module.get(ConfigService) as unknown as MockConfigService;
    jwtService = module.get(JwtService) as unknown as MockJwtService;
  });

  describe('startConnect', () => {
    it('should redirect to MP auth URL when authenticated via query param', () => {
      const req = mockRequest({ token: 'valid-token' });
      const res = mockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-123' });
      mpConnectService.generateAuthUrl.mockReturnValue({
        authUrl: 'https://auth.mercadopago.com/authorization?code=123',
        state: 'state-123',
      });

      controller.startConnect('valid-token', req, res);

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(mpConnectService.generateAuthUrl).toHaveBeenCalledWith('user-123');
      expect(res.redirect).toHaveBeenCalledWith(
        'https://auth.mercadopago.com/authorization?code=123',
      );
    });

    it('should redirect to MP auth URL when authenticated via cookie', () => {
      const req = mockRequest({ cookies: { auth_token: 'cookie-token' } });
      const res = mockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-456' });
      mpConnectService.generateAuthUrl.mockReturnValue({
        authUrl: 'https://auth.mercadopago.com/authorization?code=456',
        state: 'state-456',
      });

      controller.startConnect(undefined as unknown as string, req, res);

      expect(jwtService.verify).toHaveBeenCalledWith('cookie-token');
      expect(mpConnectService.generateAuthUrl).toHaveBeenCalledWith('user-456');
      expect(res.redirect).toHaveBeenCalledWith(
        'https://auth.mercadopago.com/authorization?code=456',
      );
    });

    it('should redirect to MP auth URL when authenticated via header', () => {
      const req = mockRequest({
        headers: { authorization: 'Bearer header-token' },
      });
      const res = mockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-789' });
      mpConnectService.generateAuthUrl.mockReturnValue({
        authUrl: 'https://auth.mercadopago.com/authorization?code=789',
        state: 'state-789',
      });

      controller.startConnect(undefined as unknown as string, req, res);

      expect(jwtService.verify).toHaveBeenCalledWith('header-token');
      expect(mpConnectService.generateAuthUrl).toHaveBeenCalledWith('user-789');
      expect(res.redirect).toHaveBeenCalledWith(
        'https://auth.mercadopago.com/authorization?code=789',
      );
    });

    it('should redirect to error page when not authenticated', () => {
      const req = mockRequest();
      const res = mockResponse();

      controller.startConnect(undefined as unknown as string, req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('mp_error='),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('No%20valid%20authentication%20found'),
      );
    });

    it('should redirect to error page on service failure', () => {
      const req = mockRequest({ token: 'valid-token' });
      const res = mockResponse();

      jwtService.verify.mockReturnValue({ sub: 'user-123' });
      mpConnectService.generateAuthUrl.mockImplementation(() => {
        throw new Error('MP API error');
      });

      controller.startConnect('valid-token', req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('mp_error='),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('MP%20API%20error'),
      );
    });
  });

  describe('handleCallback', () => {
    it('should redirect to success page when code exchange succeeds', async () => {
      const res = mockResponse();

      mpConnectService.exchangeCodeForTokens.mockResolvedValue({
        userId: 'user-123',
        mpUserId: 'mp-123',
      });

      await controller.handleCallback(
        'auth-code',
        'state-123',
        undefined as unknown as string,
        undefined as unknown as string,
        res,
      );

      expect(mpConnectService.exchangeCodeForTokens).toHaveBeenCalledWith(
        'auth-code',
        'state-123',
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/dashboard/settings?mp_connected=true',
      );
    });

    it('should redirect to error page when MP returns error', async () => {
      const res = mockResponse();

      await controller.handleCallback(
        undefined as unknown as string,
        undefined as unknown as string,
        'access_denied',
        'User denied access',
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('mp_error='),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('User%20denied%20access'),
      );
    });

    it('should redirect to error page when code is missing', async () => {
      const res = mockResponse();

      await controller.handleCallback(
        undefined as unknown as string,
        'state-123',
        undefined as unknown as string,
        undefined as unknown as string,
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('mp_error='),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('Par%C3%A1metros%20faltantes'),
      );
    });

    it('should redirect to error page when state is missing', async () => {
      const res = mockResponse();

      await controller.handleCallback(
        'auth-code',
        undefined as unknown as string,
        undefined as unknown as string,
        undefined as unknown as string,
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('mp_error='),
      );
    });

    it('should redirect to error page when code exchange fails', async () => {
      const res = mockResponse();

      mpConnectService.exchangeCodeForTokens.mockRejectedValue(
        new Error('Invalid authorization code'),
      );

      await controller.handleCallback(
        'bad-code',
        'state-123',
        undefined as unknown as string,
        undefined as unknown as string,
        res,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('mp_error='),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('Invalid%20authorization%20code'),
      );
    });
  });

  describe('getStatus', () => {
    it('should return connection status for authenticated user', async () => {
      const mockStatus = {
        connected: true,
        mpUserId: 'mp-123',
        mpConnectStatus: 'CONNECTED',
      };

      mpConnectService.getConnectionStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus({ id: 'user-123' });

      expect(mpConnectService.getConnectionStatus).toHaveBeenCalledWith(
        'user-123',
      );
      expect(result).toEqual(mockStatus);
    });
  });

  describe('disconnect', () => {
    it('should disconnect MP account successfully', async () => {
      const res = mockResponse();

      mpConnectService.disconnect.mockResolvedValue(true);

      await controller.disconnect({ id: 'user-123' }, res);

      expect(mpConnectService.disconnect).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ disconnected: true });
    });

    it('should return error on disconnect failure', async () => {
      const res = mockResponse();

      mpConnectService.disconnect.mockRejectedValue(
        new Error('MP API unavailable'),
      );

      await controller.disconnect({ id: 'user-123' }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'MP API unavailable' });
    });
  });
});
