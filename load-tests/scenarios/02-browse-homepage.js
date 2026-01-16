// Homepage browsing load test
// Simulates anonymous users browsing the raffle listings
import { check, sleep } from 'k6';
import { graphqlQuery, QUERIES } from '../helpers/graphql.js';
import { randomPagination, randomSortBy } from '../helpers/data.js';
import { thresholds, randomThinkTime } from '../config/options.js';

export const options = {
  vus: 100,
  duration: '2m',
  thresholds: thresholds,
};

export default function () {
  // Simulate homepage load - get active raffles
  const pagination = randomPagination();
  const sortBy = randomSortBy();

  const result = graphqlQuery('rafflesPaginated', QUERIES.rafflesPaginated, {
    filters: {
      estado: 'ACTIVA',
      sortBy: sortBy,
    },
    pagination: pagination,
  });

  check(result, {
    'homepage: has data': (r) => r && r.data && r.data.rafflesPaginated,
    'homepage: has items': (r) => {
      const items = r?.data?.rafflesPaginated?.items;
      return Array.isArray(items);
    },
    'homepage: has meta': (r) => {
      const meta = r?.data?.rafflesPaginated?.meta;
      return meta && typeof meta.total === 'number';
    },
  });

  // User pauses to look at listings (2-5 seconds)
  sleep(randomThinkTime(2, 5) / 1000);

  // Some users browse to next page
  if (Math.random() > 0.7 && result?.data?.rafflesPaginated?.meta?.hasNext) {
    const nextPage = graphqlQuery('rafflesPaginated_page2', QUERIES.rafflesPaginated, {
      filters: {
        estado: 'ACTIVA',
        sortBy: sortBy,
      },
      pagination: {
        page: pagination.page + 1,
        limit: pagination.limit,
      },
    });

    check(nextPage, {
      'page2: has data': (r) => r && r.data && r.data.rafflesPaginated,
    });

    sleep(randomThinkTime(2, 4) / 1000);
  }

  // Some users also fetch categories
  if (Math.random() > 0.8) {
    const categories = graphqlQuery('categories', QUERIES.categories);
    check(categories, {
      'categories: has data': (r) => r && r.data && Array.isArray(r.data.categories),
    });
  }
}
