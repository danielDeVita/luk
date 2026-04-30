import { SocialPromotionParserService } from './social-promotion-parser.service';
import {
  FACEBOOK_PUBLIC_POST_HTML,
  INSTAGRAM_PUBLIC_POST_HTML,
  PRIVATE_POST_HTML,
  X_PUBLIC_POST_HTML,
} from '../__fixtures__/public-post-html.fixture';
import { SocialPromotionNetwork } from '../entities/social-promotion.entity';

describe('SocialPromotionParserService', () => {
  let service: SocialPromotionParserService;

  beforeEach(() => {
    service = new SocialPromotionParserService();
  });

  it('detects network from supported URLs', () => {
    expect(
      service.detectNetworkFromUrl('https://www.facebook.com/test/posts/1'),
    ).toBe(SocialPromotionNetwork.FACEBOOK);
    expect(
      service.detectNetworkFromUrl('https://www.instagram.com/p/ABC123/'),
    ).toBe(SocialPromotionNetwork.INSTAGRAM);
    expect(service.detectNetworkFromUrl('https://x.com/test/status/1')).toBe(
      SocialPromotionNetwork.X,
    );
    expect(
      service.detectNetworkFromUrl('https://mobile.twitter.com/test/status/1'),
    ).toBe(SocialPromotionNetwork.X);
  });

  it('rejects deceptive hosts and insecure URL variants', () => {
    expect(() =>
      service.detectNetworkFromUrl(
        'https://instagram.com.evil.example/p/ABC123/',
      ),
    ).toThrow('Unsupported social promotion host');
    expect(() =>
      service.detectNetworkFromUrl('http://www.instagram.com/p/ABC123/'),
    ).toThrow('Unsupported social promotion protocol');
    expect(() =>
      service.detectNetworkFromUrl('https://www.instagram.com:444/p/ABC123/'),
    ).toThrow('Unsupported social promotion port');
  });

  it('canonicalizes URLs by removing query params and hashes', () => {
    expect(
      service.canonicalizePermalink(
        'https://x.com/test/status/123?utm_source=foo#section',
      ),
    ).toBe('https://x.com/test/status/123/');
  });

  it('parses Facebook public HTML', () => {
    const result = service.parsePublicContent({
      network: SocialPromotionNetwork.FACEBOOK,
      rawUrl: 'https://facebook.com/test/posts/1234567890',
      html: FACEBOOK_PUBLIC_POST_HTML,
      promotionToken: 'token-123',
      trackingUrl: 'https://luk.app/promo/token-123',
    });

    expect(result.isAccessible).toBe(true);
    expect(result.tokenPresent).toBe(true);
    expect(result.metrics.likesCount).toBe(123);
    expect(result.metrics.commentsCount).toBe(14);
    expect(result.metrics.repostsOrSharesCount).toBe(7);
  });

  it('parses Instagram public HTML', () => {
    const result = service.parsePublicContent({
      network: SocialPromotionNetwork.INSTAGRAM,
      rawUrl: 'https://instagram.com/p/ABC123',
      html: INSTAGRAM_PUBLIC_POST_HTML,
      promotionToken: 'token-123',
      trackingUrl: 'https://luk.app/promo/token-123',
    });

    expect(result.metrics.likesCount).toBe(1234);
    expect(result.metrics.commentsCount).toBe(89);
    expect(result.metrics.viewsCount).toBe(4321);
  });

  it('parses X public HTML', () => {
    const result = service.parsePublicContent({
      network: SocialPromotionNetwork.X,
      rawUrl: 'https://x.com/test/status/999',
      html: X_PUBLIC_POST_HTML,
      promotionToken: 'token-123',
      trackingUrl: 'https://luk.app/promo/token-123',
    });

    expect(result.metrics.likesCount).toBe(245);
    expect(result.metrics.commentsCount).toBe(31);
    expect(result.metrics.repostsOrSharesCount).toBe(18);
    expect(result.metrics.viewsCount).toBe(12400);
  });

  it('marks inaccessible content accordingly', () => {
    const result = service.parsePublicContent({
      network: SocialPromotionNetwork.FACEBOOK,
      rawUrl: 'https://www.facebook.com/test/posts/404',
      html: PRIVATE_POST_HTML,
      promotionToken: 'token-123',
      trackingUrl: 'https://luk.app/promo/token-123',
    });

    expect(result.isAccessible).toBe(false);
    expect(result.tokenPresent).toBe(false);
  });

  it('parses Spanish visible labels exported by the browser loader', () => {
    const result = service.parsePublicContent({
      network: SocialPromotionNetwork.FACEBOOK,
      rawUrl: 'https://www.facebook.com/test/posts/1',
      html: `
        <html><head><meta property="og:url" content="https://www.facebook.com/test/posts/1/" /></head><body></body></html>
        <!--LUK_VISIBLE_TEXT_START-->
        Publicación de Daniel
        <!--LUK_VISIBLE_TEXT_END-->
        <!--LUK_ARIA_LABELS_START-->
        Me gusta: 1 persona
        2 comentarios
        3 compartidos
        45 vistas
        <!--LUK_ARIA_LABELS_END-->
      `,
      promotionToken: 'token-123',
      trackingUrl: 'https://luk.app/promo/token-123',
    });

    expect(result.metrics.likesCount).toBe(1);
    expect(result.metrics.commentsCount).toBe(2);
    expect(result.metrics.repostsOrSharesCount).toBe(3);
    expect(result.metrics.viewsCount).toBe(45);
  });

  it('ignores canonical URLs that escape the supported network allowlist', () => {
    const result = service.parsePublicContent({
      network: SocialPromotionNetwork.INSTAGRAM,
      rawUrl: 'https://www.instagram.com/p/ABC123/',
      html: `
        <html>
          <head>
            <meta property="og:url" content="https://evil.example/steal" />
          </head>
          <body>token-123</body>
        </html>
      `,
      promotionToken: 'token-123',
      trackingUrl: 'https://luk.app/promo/token-123',
    });

    expect(result.canonicalPermalink).toBe(
      'https://www.instagram.com/p/ABC123/',
    );
  });
});
