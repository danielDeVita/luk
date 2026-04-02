import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let service: TurnstileService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const envState = {
    TURNSTILE_ENABLED: false,
    TURNSTILE_SECRET_KEY: '',
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      if (key in envState) {
        return envState[key as keyof typeof envState];
      }

      return defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    envState.TURNSTILE_ENABLED = false;
    envState.TURNSTILE_SECRET_KEY = '';
    fetchSpy = jest.spyOn(global, 'fetch');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnstileService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TurnstileService>(TurnstileService);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('bypasses verification when turnstile is disabled', async () => {
    await expect(service.assertHuman(undefined)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects when captcha token is missing and turnstile is enabled', async () => {
    envState.TURNSTILE_ENABLED = true;
    envState.TURNSTILE_SECRET_KEY = 'secret-key';

    await expect(service.assertHuman(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts a valid captcha token when the provider verifies it', async () => {
    envState.TURNSTILE_ENABLED = true;
    envState.TURNSTILE_SECRET_KEY = 'secret-key';
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await expect(
      service.assertHuman('captcha-token', '203.0.113.10'),
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('response=captcha-token'),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('remoteip=203.0.113.10'),
      }),
    );
  });

  it('fails closed when the provider rejects the captcha token', async () => {
    envState.TURNSTILE_ENABLED = true;
    envState.TURNSTILE_SECRET_KEY = 'secret-key';
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    } as Response);

    await expect(service.assertHuman('captcha-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when turnstile verification request errors', async () => {
    envState.TURNSTILE_ENABLED = true;
    envState.TURNSTILE_SECRET_KEY = 'secret-key';
    fetchSpy.mockRejectedValue(new Error('network failed'));

    await expect(service.assertHuman('captcha-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
