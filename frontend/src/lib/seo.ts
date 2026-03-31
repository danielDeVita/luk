import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_SHORT_DESCRIPTION,
  BRAND_TAGLINE,
} from '@/lib/brand';
import { getPublicSiteUrl } from '@/lib/public-env';

export function getSiteOrigin(): URL {
  return new URL(getPublicSiteUrl());
}

export function buildAbsoluteUrl(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, getSiteOrigin()).toString();
}

export function buildOrganizationJsonLd() {
  const homeUrl = buildAbsoluteUrl('/');

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${homeUrl}#organization`,
    name: BRAND_NAME,
    url: homeUrl,
    description: BRAND_SHORT_DESCRIPTION,
    areaServed: 'AR',
  };
}

export function buildWebsiteJsonLd() {
  const homeUrl = buildAbsoluteUrl('/');

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${homeUrl}#website`,
    name: BRAND_NAME,
    url: homeUrl,
    description: BRAND_DESCRIPTION,
    inLanguage: 'es-AR',
    alternateName: BRAND_TAGLINE,
  };
}
