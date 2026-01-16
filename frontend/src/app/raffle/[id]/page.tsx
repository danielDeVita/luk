import type { Metadata } from 'next';
import { RaffleContent } from './raffle-content';

// GraphQL query for server-side metadata fetching
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
        nombre
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
  };
  seller?: {
    nombre: string;
  };
}

interface GraphQLResponse {
  data?: {
    raffle: RaffleMetadata | null;
  };
  errors?: Array<{ message: string }>;
}

async function fetchRaffleForMetadata(id: string): Promise<RaffleMetadata | null> {
  const graphqlUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3001/graphql';

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: GET_RAFFLE_QUERY,
        variables: { id },
      }),
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      return null;
    }

    const result: GraphQLResponse = await response.json();
    return result.data?.raffle || null;
  } catch {
    return null;
  }
}

/**
 * Generate JSON-LD structured data for SEO (Product schema)
 */
function generateJsonLd(raffle: RaffleMetadata, raffleUrl: string) {
  const image = raffle.product?.imagenes?.[0];
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: raffle.titulo,
    description: raffle.descripcion,
    ...(image && { image: image }),
    offers: {
      '@type': 'Offer',
      price: raffle.precioPorTicket,
      priceCurrency: 'ARS',
      availability: raffle.estado === 'ACTIVA'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: raffleUrl,
      ...(raffle.seller && {
        seller: {
          '@type': 'Person',
          name: raffle.seller.nombre,
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
      title: 'Rifa no encontrada - Rifas',
      description: 'La rifa que buscas no existe o fue eliminada.',
    };
  }

  const title = `${raffle.titulo} - Rifa`;
  const description = raffle.descripcion.length > 160
    ? raffle.descripcion.substring(0, 157) + '...'
    : raffle.descripcion;
  const image = raffle.product?.imagenes?.[0];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const raffleUrl = `${siteUrl}/raffle/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: raffleUrl,
      siteName: 'Rifas',
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
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const raffleUrl = `${siteUrl}/raffle/${id}`;
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

