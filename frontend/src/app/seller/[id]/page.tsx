import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import { fetchPublicGraphql } from '@/lib/public-graphql';
import { buildAbsoluteUrl } from '@/lib/seo';
import { SellerProfileContent } from './seller-profile-content';
import {
  GET_SELLER_PROFILE_QUERY,
  type PublicSellerProfile,
  type SellerProfileQueryData,
} from './seller-profile.shared';

async function fetchSellerProfile(id: string): Promise<PublicSellerProfile | null> {
  const data = await fetchPublicGraphql<SellerProfileQueryData, { id: string }>(
    GET_SELLER_PROFILE_QUERY,
    { id },
    { revalidate: 300 },
  );

  return data?.sellerProfile ?? null;
}

function buildSellerJsonLd(profile: PublicSellerProfile, sellerUrl: string) {
  const sellerName = `${profile.nombre} ${profile.apellido}`.trim();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${sellerUrl}#person`,
        name: sellerName,
        url: sellerUrl,
        description: `Perfil público de ${sellerName} en ${BRAND_NAME}.`,
      },
      {
        '@type': 'ProfilePage',
        '@id': `${sellerUrl}#profile`,
        url: sellerUrl,
        name: `Perfil de ${sellerName}`,
        mainEntity: {
          '@id': `${sellerUrl}#person`,
        },
        isPartOf: {
          '@id': `${buildAbsoluteUrl('/')}#website`,
        },
      },
    ],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await fetchSellerProfile(id);

  if (!profile) {
    return {
      title: 'Vendedor no encontrado',
      description: 'El perfil público del vendedor no está disponible.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const sellerName = `${profile.nombre} ${profile.apellido}`.trim();
  const description = profile.isVerified
    ? `${sellerName} es un vendedor verificado en ${BRAND_NAME} con ${profile.totalVentas} ventas registradas y ${profile.raffles.length} rifas públicas.`
    : `${sellerName} publica rifas en ${BRAND_NAME} y tiene ${profile.totalVentas} ventas registradas.`;

  return {
    title: `${sellerName} | Vendedor`,
    description,
    alternates: {
      canonical: `/seller/${id}`,
    },
    openGraph: {
      title: `${sellerName} | Vendedor`,
      description,
      type: 'website',
      url: `/seller/${id}`,
      siteName: BRAND_NAME,
    },
    twitter: {
      card: 'summary',
      title: `${sellerName} | Vendedor`,
      description,
    },
  };
}

export default async function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await fetchSellerProfile(id);
  const sellerUrl = buildAbsoluteUrl(`/seller/${id}`);
  const jsonLd = profile ? buildSellerJsonLd(profile, sellerUrl) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SellerProfileContent sellerId={id} />
    </>
  );
}
