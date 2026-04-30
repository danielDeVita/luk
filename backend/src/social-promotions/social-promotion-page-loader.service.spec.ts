import { ConfigService } from '@nestjs/config';
import { SocialPromotionPageLoaderService } from './social-promotion-page-loader.service';

describe('SocialPromotionPageLoaderService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses Playwright first when preferBrowser is requested and browser support is enabled', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'SOCIAL_PROMOTION_FETCH_TIMEOUT_MS') return 30000;
        if (key === 'SOCIAL_PROMOTION_BROWSER_ENABLED') return true;
        return fallback;
      }),
    } as unknown as ConfigService;

    const service = new SocialPromotionPageLoaderService(configService);
    const loadWithPlaywright = jest
      .spyOn<any, any>(service as any, 'loadWithPlaywright')
      .mockResolvedValue({
        html: '<html>playwright</html>',
        finalUrl: 'https://x.com/test/status/1',
        loader: 'playwright',
      });
    const loadWithFetch = jest
      .spyOn<any, any>(service as any, 'loadWithFetch')
      .mockResolvedValue({
        html: '<html>fetch</html>',
        finalUrl: 'https://x.com/test/status/1',
        loader: 'fetch',
      });

    const result = await service.loadPublicPage('https://x.com/test/status/1', {
      preferBrowser: true,
    });

    expect(loadWithPlaywright).toHaveBeenCalledTimes(1);
    expect(loadWithFetch).not.toHaveBeenCalled();
    expect(result.loader).toBe('playwright');
  });

  it('falls back to fetch when browser support is disabled', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'SOCIAL_PROMOTION_FETCH_TIMEOUT_MS') return 30000;
        if (key === 'SOCIAL_PROMOTION_BROWSER_ENABLED') return false;
        return fallback;
      }),
    } as unknown as ConfigService;

    const service = new SocialPromotionPageLoaderService(configService);
    const loadWithPlaywright = jest
      .spyOn<any, any>(service as any, 'loadWithPlaywright')
      .mockResolvedValue({
        html: '<html>playwright</html>',
        finalUrl: 'https://x.com/test/status/1',
        loader: 'playwright',
      });
    const loadWithFetch = jest
      .spyOn<any, any>(service as any, 'loadWithFetch')
      .mockResolvedValue({
        html: '<html>fetch</html>',
        finalUrl: 'https://x.com/test/status/1',
        loader: 'fetch',
      });

    const result = await service.loadPublicPage('https://x.com/test/status/1', {
      preferBrowser: true,
    });

    expect(loadWithPlaywright).not.toHaveBeenCalled();
    expect(loadWithFetch).toHaveBeenCalledTimes(1);
    expect(result.loader).toBe('fetch');
  });

  it('follows safe redirects that stay within the supported network', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'SOCIAL_PROMOTION_FETCH_TIMEOUT_MS') return 30000;
        if (key === 'SOCIAL_PROMOTION_BROWSER_ENABLED') return false;
        return fallback;
      }),
    } as unknown as ConfigService;

    const service = new SocialPromotionPageLoaderService(configService);
    const fetchSpy = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce({
        status: 301,
        url: 'https://twitter.com/test/status/1',
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'location'
              ? 'https://x.com/test/status/1'
              : null,
        },
        text: jest.fn(),
      } as never)
      .mockResolvedValueOnce({
        status: 200,
        url: 'https://x.com/test/status/1',
        headers: { get: () => null },
        text: jest.fn().mockResolvedValue('<html>ok</html>'),
      } as never);

    const result = await service.loadPublicPage(
      'https://twitter.com/test/status/1',
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.finalUrl).toBe('https://x.com/test/status/1');
    expect(result.html).toBe('<html>ok</html>');
  });

  it('rejects redirects that escape the supported network allowlist', async () => {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'SOCIAL_PROMOTION_FETCH_TIMEOUT_MS') return 30000;
        if (key === 'SOCIAL_PROMOTION_BROWSER_ENABLED') return false;
        return fallback;
      }),
    } as unknown as ConfigService;

    const service = new SocialPromotionPageLoaderService(configService);
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      status: 302,
      url: 'https://www.instagram.com/p/ABC123/',
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'location'
            ? 'https://evil.example/redirected'
            : null,
      },
      text: jest.fn(),
    } as never);

    await expect(
      service.loadPublicPage('https://www.instagram.com/p/ABC123/'),
    ).rejects.toThrow('Unsupported social promotion host');
  });
});
