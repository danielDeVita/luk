import type { Metadata } from 'next';
import { RaffleContent } from './raffle-content';
import { BRAND_NAME } from '@/lib/brand';
import { fetchPublicGraphql } from '@/lib/public-graphql';
import { buildAbsoluteUrl } from '@/lib/seo';

const GET_RAFFLE_QUERY = `
  query GetRaffle($id: String!) {
    raffle(id: $id) {
      id
      titulo
      descripcion
      precioPorTicket
      estado
      product {
        nombre
        imagenes
        categoria
      }
      seller {
        id
        nombre
        apellido
      }
    }
  }
`;

interface RaffleMetadata {
  id: string;
  titulo: string;
  descripcion: string;
  precioPorTicket: number;
  estado: string;
  product?: {
    nombre: string;
    imagenes?: string[];
    categoria?: string;
  } | null;
  seller?: {
    id?: string;
    nombre: string;
    apellido?: string;
  } | null;
}

interface RaffleQueryData {
  raffle: RaffleMetadata | null;
}

async function fetchRaffleForMetadata(id: string): Promise<RaffleMetadata | null> {
  const data = await fetchPublicGraphql<RaffleQueryData, { id: string }>(
    GET_RAFFLE_QUERY,
    { id },
    { revalidate: 60 },
  );

  return data?.raffle ?? null;
}

function isIndexableRaffle(raffle: RaffleMetadata | null): boolean {
  return raffle?.estado === 'ACTIVA';
}

function generateJsonLd(raffle: RaffleMetadata, raffleUrl: string) {
  const image = raffle.product?.imagenes?.[0];
  const sellerName = [raffle.seller?.nombre, raffle.seller?.apellido]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: raffle.product?.nombre || raffle.titulo,
    description: raffle.descripcion,
    url: raffleUrl,
    ...(image && { image }),
    brand: {
      '@type': 'Organization',
      name: BRAND_NAME,
    },
    offers: {
      '@type': 'Offer',
      price: raffle.precioPorTicket,
      priceCurrency: 'ARS',
      availability:
        raffle.estado === 'ACTIVA'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: raffleUrl,
      ...(sellerName && {
        seller: {
          '@type': 'Person',
          name: sellerName,
        },
      }),
    },
    ...(raffle.product?.categoria && {
      category: raffle.product.categoria,
    }),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const raffle = await fetchRaffleForMetadata(id);

  if (!raffle) {
    return {
      title: 'Rifa no encontrada',
      description: 'La rifa que buscás no existe o ya no está disponible.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${raffle.titulo} | Rifa`;
  const description =
    raffle.descripcion.length > 160
      ? `${raffle.descripcion.substring(0, 157)}...`
      : raffle.descripcion;
  const image = raffle.product?.imagenes?.[0];

  return {
    title,
    description,
    alternates: {
      canonical: `/raffle/${id}`,
    },
    robots: {
      index: isIndexableRaffle(raffle),
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/raffle/${id}`,
      siteName: BRAND_NAME,
      ...(image && {
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: raffle.titulo,
          },
        ],
      }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image && { images: [image] }),
    },
  };
}

export default async function RafflePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const raffle = await fetchRaffleForMetadata(id);
  const raffleUrl = buildAbsoluteUrl(`/raffle/${id}`);
  const jsonLd = raffle ? generateJsonLd(raffle, raffleUrl) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <RaffleContent id={id} />
    </>
  );
}
