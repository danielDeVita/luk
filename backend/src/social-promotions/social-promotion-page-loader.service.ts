import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
    if (options.preferBrowser && this.browserEnabled) {
      try {
        return await this.loadWithPlaywright(url);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Preferred Playwright load failed for ${url}: ${message}`,
        );
      }
    }

    const fetched = await this.loadWithFetch(url);

    if (!this.shouldFallbackToBrowser(url, fetched.html)) {
      return fetched;
    }

    if (!this.browserEnabled) {
      return fetched;
    }

    try {
      return await this.loadWithPlaywright(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Playwright fallback failed for ${url}: ${message}`);
      return fetched;
    }
  }

  private async loadWithFetch(url: string): Promise<SocialPromotionLoadedPage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; LukSocialPromotionBot/1.0; +https://luk.app)',
        },
      });
      const html = await response.text();

      return {
        html,
        finalUrl: response.url || url,
        loader: 'fetch',
      };
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

      return {
        html: enrichedHtml,
        finalUrl: page.url(),
        loader: 'playwright',
      };
    } finally {
      await browser.close();
    }
  }
}
