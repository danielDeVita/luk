import { Injectable } from '@nestjs/common';
import { SocialPromotionNetwork } from '../entities/social-promotion.entity';

export interface ParsedSocialPromotionMetrics {
  likesCount?: number;
  commentsCount?: number;
  repostsOrSharesCount?: number;
  viewsCount?: number;
}

export interface ParsedSocialPromotionResult {
  canonicalPermalink: string;
  canonicalPostId?: string;
  isAccessible: boolean;
  tokenPresent: boolean;
  metrics: ParsedSocialPromotionMetrics;
}

@Injectable()
export class SocialPromotionParserService {
  detectNetworkFromUrl(rawUrl: string): SocialPromotionNetwork {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();

    if (host.includes('facebook.com')) return SocialPromotionNetwork.FACEBOOK;
    if (host.includes('instagram.com')) return SocialPromotionNetwork.INSTAGRAM;
    if (host.includes('threads.net')) return SocialPromotionNetwork.THREADS;
    if (
      host === 'x.com' ||
      host.endsWith('.x.com') ||
      host.includes('twitter.com')
    ) {
      return SocialPromotionNetwork.X;
    }

    throw new Error(`Unsupported social promotion host: ${host}`);
  }

  canonicalizePermalink(rawUrl: string): string {
    const url = new URL(rawUrl);
    url.hash = '';
    url.search = '';

    if (url.hostname === 'm.facebook.com') {
      url.hostname = 'www.facebook.com';
    }
    if (url.hostname.endsWith('twitter.com')) {
      url.hostname = 'x.com';
    }
    if (!url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`;
    }

    return url.toString();
  }

  parsePublicContent(params: {
    network: SocialPromotionNetwork;
    rawUrl: string;
    html: string;
    promotionToken: string;
    trackingUrl: string;
  }): ParsedSocialPromotionResult {
    const canonicalPermalink =
      this.extractCanonicalUrl(params.html) ??
      this.canonicalizePermalink(params.rawUrl);

    return {
      canonicalPermalink,
      canonicalPostId: this.extractCanonicalPostId(
        params.network,
        canonicalPermalink,
      ),
      isAccessible: this.isAccessibleContent(params.html),
      tokenPresent: this.detectTokenPresence(
        params.html,
        params.promotionToken,
        params.trackingUrl,
      ),
      metrics: this.extractVisibleMetrics(params.network, params.html),
    };
  }

  detectTokenPresence(
    html: string,
    promotionToken: string,
    trackingUrl: string,
  ): boolean {
    const lowered = html.toLowerCase();
    return (
      lowered.includes(promotionToken.toLowerCase()) ||
      lowered.includes(trackingUrl.toLowerCase())
    );
  }

  private extractCanonicalUrl(html: string): string | null {
    const match =
      html.match(/property=["']og:url["']\s+content=["']([^"']+)["']/i) ??
      html.match(/rel=["']canonical["']\s+href=["']([^"']+)["']/i);

    return match?.[1] ?? null;
  }

  private isAccessibleContent(html: string): boolean {
    const lowered = html.toLowerCase();
    return !(
      lowered.includes('contenido no disponible') ||
      lowered.includes('content unavailable') ||
      lowered.includes("page isn't available")
    );
  }

  private extractCanonicalPostId(
    network: SocialPromotionNetwork,
    canonicalPermalink: string,
  ): string | undefined {
    const url = new URL(canonicalPermalink);

    switch (network) {
      case SocialPromotionNetwork.FACEBOOK:
        return url.pathname.split('/').filter(Boolean).pop();
      case SocialPromotionNetwork.INSTAGRAM:
        return url.pathname.split('/').filter(Boolean).pop();
      case SocialPromotionNetwork.X:
        return url.pathname.split('/').filter(Boolean).pop();
      case SocialPromotionNetwork.THREADS:
        return url.pathname.split('/').filter(Boolean).pop();
      default:
        return undefined;
    }
  }

  private extractVisibleMetrics(
    network: SocialPromotionNetwork,
    html: string,
  ): ParsedSocialPromotionMetrics {
    switch (network) {
      case SocialPromotionNetwork.FACEBOOK:
        return {
          likesCount: this.extractMetric(html, [
            /(?:me gusta|reacciones?)\s*:\s*(\d[\d.,KkMm]*)\s*(?:persona|personas)?/i,
            /(\d[\d.,KkMm]*)\s+(?:me gusta|reacciones?)/i,
            /(\d[\d.,KkMm]*)\s+reactions?/i,
          ]),
          commentsCount: this.extractMetric(html, [
            /(?:comentarios?|comments?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(?:ver\s+)?(\d[\d.,KkMm]*)\s+(?:comentarios?|comments?)/i,
          ]),
          repostsOrSharesCount: this.extractMetric(html, [
            /(?:compartidos?|shares?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:compartidos?|shares?)/i,
          ]),
          viewsCount: this.extractMetric(html, [
            /(?:vistas?|views?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:vistas?|views?)/i,
          ]),
        };
      case SocialPromotionNetwork.INSTAGRAM:
        return {
          likesCount: this.extractMetric(html, [
            /(?:me gusta|likes?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:me gusta|likes?)/i,
          ]),
          commentsCount: this.extractMetric(html, [
            /(?:comentarios?|comments?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:comentarios?|comments?)/i,
          ]),
          viewsCount: this.extractMetric(html, [
            /(?:visualizaciones|vistas?|views?|reproducciones)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:visualizaciones|vistas?|views?|reproducciones)/i,
          ]),
        };
      case SocialPromotionNetwork.X:
        return {
          likesCount: this.extractMetric(html, [
            /(?:me gusta|likes?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:me gusta|likes?)/i,
          ]),
          commentsCount: this.extractMetric(html, [
            /(?:comentarios?|comments?|repl(?:y|ies)|respuestas?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:comentarios?|comments?|repl(?:y|ies)|respuestas?)/i,
          ]),
          repostsOrSharesCount: this.extractMetric(html, [
            /(?:reposts?|retweets?|quotes?|republicaciones|compartidos?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:reposts?|retweets?|quotes?|republicaciones|compartidos?)/i,
          ]),
          viewsCount: this.extractMetric(html, [
            /(?:visualizaciones|vistas?|views?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:visualizaciones|vistas?|views?)/i,
          ]),
        };
      case SocialPromotionNetwork.THREADS:
        return {
          likesCount: this.extractMetric(html, [
            /(?:me gusta|likes?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:me gusta|likes?)/i,
          ]),
          commentsCount: this.extractMetric(html, [
            /(?:comentarios?|comments?|repl(?:y|ies)|respuestas?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:comentarios?|comments?|repl(?:y|ies)|respuestas?)/i,
          ]),
          repostsOrSharesCount: this.extractMetric(html, [
            /(?:reposts?|requotes?|republicaciones|compartidos?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:reposts?|requotes?|republicaciones|compartidos?)/i,
          ]),
          viewsCount: this.extractMetric(html, [
            /(?:visualizaciones|vistas?|views?)\s*:\s*(\d[\d.,KkMm]*)/i,
            /(\d[\d.,KkMm]*)\s+(?:visualizaciones|vistas?|views?)/i,
          ]),
        };
    }
  }

  private extractMetric(html: string, patterns: RegExp[]): number | undefined {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return this.parseMetricValue(match[1]);
      }
    }

    return undefined;
  }

  private parseMetricValue(value: string): number {
    const normalized = value.trim().replace(/,/g, '').toUpperCase();

    if (normalized.endsWith('K')) {
      return Math.round(parseFloat(normalized.slice(0, -1)) * 1000);
    }
    if (normalized.endsWith('M')) {
      return Math.round(parseFloat(normalized.slice(0, -1)) * 1_000_000);
    }

    return parseInt(normalized, 10);
  }
}
