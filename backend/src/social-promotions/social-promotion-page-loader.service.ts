import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialPromotionNetwork } from './entities/social-promotion.entity';
import {
  assertSupportedSocialPromotionUrl,
  detectSocialPromotionNetworkFromUrl,
} from './social-promotion-url-policy';

/**
 * Loaded page payload used by the validation pipeline after fetch or Playwright fallback.
 */
export interface SocialPromotionLoadedPage {
  html: string;
  finalUrl: string;
  loader: 'fetch' | 'playwright';
}

interface LoadPublicPageOptions {
  preferBrowser?: boolean;
}

const MAX_REDIRECTS = 5;

/**
 * Loads publicly accessible social post pages, preferring fetch and falling back to Playwright when needed.
 */
@Injectable()
export class SocialPromotionPageLoaderService {
  private readonly logger = new Logger(SocialPromotionPageLoaderService.name);
  private readonly fetchTimeoutMs: number;
  private readonly browserEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.fetchTimeoutMs = this.configService.get<number>(
      'SOCIAL_PROMOTION_FETCH_TIMEOUT_MS',
      30000,
    );
    this.browserEnabled = this.configService.get<boolean>(
      'SOCIAL_PROMOTION_BROWSER_ENABLED',
      false,
    );
  }

  /**
   * Loads a public post page and falls back to a browser when the HTML shell is not enough.
   */
  async loadPublicPage(
    url: string,
    options: LoadPublicPageOptions = {},
  ): Promise<SocialPromotionLoadedPage> {
    const network = detectSocialPromotionNetworkFromUrl(url);

    if (options.preferBrowser && this.browserEnabled) {
      try {
        return await this.loadWithPlaywright(url, network);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Preferred Playwright load failed for ${url}: ${message}`,
        );
      }
    }

    const fetched = await this.loadWithFetch(url, network);

    if (!this.shouldFallbackToBrowser(url, fetched.html)) {
      return fetched;
    }

    if (!this.browserEnabled) {
      return fetched;
    }

    try {
      return await this.loadWithPlaywright(url, network);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Playwright fallback failed for ${url}: ${message}`);
      return fetched;
    }
  }

  private async loadWithFetch(
    url: string,
    network: SocialPromotionNetwork,
  ): Promise<SocialPromotionLoadedPage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    let currentUrl = assertSupportedSocialPromotionUrl(
      url,
      network,
    ).url.toString();
    let redirectsFollowed = 0;

    try {
      while (redirectsFollowed <= MAX_REDIRECTS) {
        const response = await fetch(currentUrl, {
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; LukSocialPromotionBot/1.0; +https://luk.app)',
          },
        });

        if (this.isRedirectStatus(response.status)) {
          if (redirectsFollowed === MAX_REDIRECTS) {
            throw new Error('Too many redirects loading social promotion page');
          }

          const redirectLocation = response.headers.get('location');

          if (!redirectLocation) {
            throw new Error('Redirect response missing location header');
          }

          currentUrl = assertSupportedSocialPromotionUrl(
            new URL(redirectLocation, currentUrl).toString(),
            network,
          ).url.toString();
          redirectsFollowed += 1;
          continue;
        }

        const finalUrl = assertSupportedSocialPromotionUrl(
          response.url || currentUrl,
          network,
        ).url.toString();
        const html = await response.text();

        return {
          html,
          finalUrl,
          loader: 'fetch',
        };
      }

      throw new Error('Too many redirects loading social promotion page');
    } finally {
      clearTimeout(timeout);
    }
  }

  private shouldFallbackToBrowser(url: string, html: string): boolean {
    const lowered = html.toLowerCase();
    const isLikelyJsShell =
      lowered.includes('enable javascript') ||
      lowered.includes('__next') ||
      lowered.includes('window.__additional_data_loaded') ||
      lowered.length < 1200;

    return isLikelyJsShell || /facebook|instagram|x\.com|twitter/i.test(url);
  }

  private async loadWithPlaywright(
    url: string,
    network: SocialPromotionNetwork,
  ): Promise<SocialPromotionLoadedPage> {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage({
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      });
      await page.route('**/*', (route) => {
        const request = route.request();
        const requestUrl = request.url();

        if (
          !request.isNavigationRequest() &&
          request.resourceType() !== 'document'
        ) {
          return route.continue();
        }

        if (!/^https?:/i.test(requestUrl)) {
          return route.continue();
        }

        try {
          assertSupportedSocialPromotionUrl(requestUrl, network);
          return route.continue();
        } catch {
          return route.abort('blockedbyclient');
        }
      });
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.fetchTimeoutMs,
      });
      await page
        .waitForLoadState('networkidle', {
          timeout: Math.min(this.fetchTimeoutMs, 8000),
        })
        .catch(() => undefined);
      await page
        .waitForFunction(
          () => {
            const text = document.body?.innerText?.trim() ?? '';
            return text.length > 32 && !/^loading…?$/i.test(text);
          },
          {
            timeout: Math.min(this.fetchTimeoutMs, 6000),
          },
        )
        .catch(() => undefined);

      const html = await page.content();
      const visibleText = await page.evaluate(
        () => document.body?.innerText ?? '',
      );
      const ariaLabels = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[aria-label]'))
          .map((element) => element.getAttribute('aria-label'))
          .filter((label): label is string => Boolean(label))
          .join('\n'),
      );
      const enrichedHtml = [
        html,
        '<!--LUK_VISIBLE_TEXT_START-->',
        visibleText,
        '<!--LUK_VISIBLE_TEXT_END-->',
        '<!--LUK_ARIA_LABELS_START-->',
        ariaLabels,
        '<!--LUK_ARIA_LABELS_END-->',
      ].join('\n');
      const finalUrl = assertSupportedSocialPromotionUrl(
        page.url(),
        network,
      ).url.toString();

      return {
        html: enrichedHtml,
        finalUrl,
        loader: 'playwright',
      };
    } finally {
      await browser.close();
    }
  }

  private isRedirectStatus(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status);
  }
}
