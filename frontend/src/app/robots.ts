import type { MetadataRoute } from 'next';
import { buildAbsoluteUrl, getSiteOrigin } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/auth/', '/checkout/', '/checkout/mock/'],
    },
    sitemap: buildAbsoluteUrl('/sitemap.xml'),
    host: getSiteOrigin().toString(),
  };
}
