// Search and filter load test
// Simulates users searching for products with various filters
import { check, sleep } from 'k6';
import { graphqlQuery, QUERIES } from '../helpers/graphql.js';
import { randomSearchTerm, randomCategory, randomPriceRange, randomSortBy } from '../helpers/data.js';
import { thresholds, randomThinkTime } from '../config/options.js';

export const options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    ...thresholds,
    // Search can be slightly slower due to full-text search
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
  },
};

export default function () {
  // Scenario 1: Full-text search (most intensive)
  const searchTerm = randomSearchTerm();
  const searchResult = graphqlQuery('search_fulltext', QUERIES.rafflesPaginated, {
    filters: {
      searchTerm: searchTerm,
      estado: 'ACTIVA',
    },
    pagination: { page: 1, limit: 20 },
  });

  check(searchResult, {
    'search: returns data': (r) => r && r.data && r.data.rafflesPaginated,
    'search: no errors': (r) => !r?.errors,
  });

  // User reads results (3-7 seconds)
  sleep(randomThinkTime(3, 7) / 1000);

  // Scenario 2: Category filter
  if (Math.random() > 0.5) {
    const category = randomCategory();
    const categoryResult = graphqlQuery('search_category', QUERIES.rafflesPaginated, {
      filters: {
        categoria: category,
        estado: 'ACTIVA',
        sortBy: randomSortBy(),
      },
      pagination: { page: 1, limit: 20 },
    });

    check(categoryResult, {
      'category: returns data': (r) => r && r.data && r.data.rafflesPaginated,
    });

    sleep(randomThinkTime(2, 4) / 1000);
  }

  // Scenario 3: Price range filter
  if (Math.random() > 0.6) {
    const priceRange = randomPriceRange();
    const priceResult = graphqlQuery('search_price', QUERIES.rafflesPaginated, {
      filters: {
        precioMin: priceRange.precioMin,
        precioMax: priceRange.precioMax,
        estado: 'ACTIVA',
        sortBy: 'PRICE_ASC',
      },
      pagination: { page: 1, limit: 20 },
    });

    check(priceResult, {
      'price: returns data': (r) => r && r.data && r.data.rafflesPaginated,
    });

    sleep(randomThinkTime(2, 4) / 1000);
  }

  // Scenario 4: Combined filters
  if (Math.random() > 0.7) {
    const priceRange = randomPriceRange();
    const combinedResult = graphqlQuery('search_combined', QUERIES.rafflesPaginated, {
      filters: {
        searchTerm: randomSearchTerm(),
        precioMin: priceRange.precioMin,
        precioMax: priceRange.precioMax,
        estado: 'ACTIVA',
        sortBy: 'ENDING_SOON',
      },
      pagination: { page: 1, limit: 20 },
    });

    check(combinedResult, {
      'combined: returns data': (r) => r && r.data && r.data.rafflesPaginated,
    });

    sleep(randomThinkTime(3, 5) / 1000);
  }
}
