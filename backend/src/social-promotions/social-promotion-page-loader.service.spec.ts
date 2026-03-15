import { ConfigService } from '@nestjs/config';
import { SocialPromotionPageLoaderService } from './social-promotion-page-loader.service';

describe('SocialPromotionPageLoaderService', () => {
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
});
