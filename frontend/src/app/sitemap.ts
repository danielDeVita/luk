import type { MetadataRoute } from 'next';
import { fetchPublicGraphql } from '@/lib/public-graphql';
import { buildAbsoluteUrl } from '@/lib/seo';

export const revalidate = 3600;

const GET_PUBLIC_RAFFLES_FOR_SITEMAP = `
  query GetPublicRafflesForSitemap($pagination: PaginationInput, $filters: RaffleFiltersInput) {
    rafflesPaginated(pagination: $pagination, filters: $filters) {
      items {
        id
        updatedAt
        seller {
          id
        }
      }
      meta {
        page
        totalPages
        hasNext
      }
    }
  }
`;

interface SitemapRaffleItem {
  id: string;
  updatedAt: string;
  seller?: {
    id: string;
  } | null;
}

interface SitemapQueryData {
  rafflesPaginated: {
    items: SitemapRaffleItem[];
    meta: {
      page: number;
      totalPages: number;
      hasNext: boolean;
    };
  };
}

function buildStaticRoutes(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: buildAbsoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: buildAbsoluteUrl('/legal/terminos'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: buildAbsoluteUrl('/legal/privacidad'),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}

async function fetchActiveRaffles(): Promise<SitemapRaffleItem[]> {
  const raffles: SitemapRaffleItem[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= 20) {
    const data = await fetchPublicGraphql<
      SitemapQueryData,
      {
        pagination: { limit: number; page: number };
        filters: { estado: string };
      }
    >(
      GET_PUBLIC_RAFFLES_FOR_SITEMAP,
      {
        pagination: { limit: 100, page },
        filters: { estado: 'ACTIVA' },
      },
      { revalidate },
    );

    if (!data?.rafflesPaginated) {
      break;
    }

    raffles.push(...data.rafflesPaginated.items);
    hasNextPage = data.rafflesPaginated.meta.hasNext;
    page += 1;
  }

  return raffles;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = buildStaticRoutes();
  const raffles = await fetchActiveRaffles();

  if (raffles.length === 0) {
    return staticRoutes;
  }

  const sellerRoutes = new Map<string, Date>();

  for (const raffle of raffles) {
    if (!raffle.seller?.id) {
      continue;
    }

    const lastModified = new Date(raffle.updatedAt);
    const currentLastModified = sellerRoutes.get(raffle.seller.id);

    if (!currentLastModified || lastModified > currentLastModified) {
      sellerRoutes.set(raffle.seller.id, lastModified);
    }
  }

  return [
    ...staticRoutes,
    ...raffles.map((raffle) => ({
      url: buildAbsoluteUrl(`/raffle/${raffle.id}`),
      lastModified: new Date(raffle.updatedAt),
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
    ...Array.from(sellerRoutes.entries()).map(([sellerId, lastModified]) => ({
      url: buildAbsoluteUrl(`/seller/${sellerId}`),
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
  ];
}
