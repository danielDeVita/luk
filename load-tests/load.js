// Standard load test - Simulates normal traffic patterns
// Runs multiple scenarios with realistic user distribution
import { sleep, group } from 'k6';
import { BASE_URL } from './config/options.js';
import { graphqlQuery, QUERIES, MUTATIONS } from './helpers/graphql.js';
import { login, TEST_USERS, getTestUserToken } from './helpers/auth.js';
import { randomSearchTerm, randomPagination, randomSortBy, randomPriceRange, randomTicketQuantity } from './helpers/data.js';
import { randomThinkTime } from './config/options.js';
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    // Ramp up to 50 VUs over 1 minute, hold for 3 minutes, ramp down
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:load_test}': ['p(95)<600'],
  },
};

// Shared state
let activeRaffles = [];

export function setup() {
  // Pre-fetch some raffle IDs for the test
  const result = graphqlQuery('setup', QUERIES.rafflesPaginated, {
    filters: { estado: 'ACTIVA' },
    pagination: { page: 1, limit: 50 },
  });

  if (result?.data?.rafflesPaginated?.items) {
    activeRaffles = result.data.rafflesPaginated.items;
  }

  // Pre-login buyer for authenticated scenarios
  const buyerToken = getTestUserToken('buyer');

  return { activeRaffles, buyerToken };
}

export default function (data) {
  const { activeRaffles, buyerToken } = data;

  // Distribute scenarios based on realistic traffic patterns
  const scenario = Math.random();

  if (scenario < 0.40) {
    // 40% - Browse homepage
    browseHomepage();
  } else if (scenario < 0.65) {
    // 25% - Search
    searchRaffles();
  } else if (scenario < 0.85) {
    // 20% - View detail
    viewRaffleDetail(activeRaffles);
  } else if (scenario < 0.95) {
    // 10% - Authenticated actions
    authenticatedActions(buyerToken, activeRaffles);
  } else {
    // 5% - Health check
    healthCheck();
  }
}

function browseHomepage() {
  group('Browse Homepage', function () {
    const pagination = randomPagination();
    const sortBy = randomSortBy();

    graphqlQuery('browse', QUERIES.rafflesPaginated, {
      filters: { estado: 'ACTIVA', sortBy },
      pagination,
    });

    sleep(randomThinkTime(2, 5) / 1000);

    // Some users also get categories
    if (Math.random() > 0.7) {
      graphqlQuery('categories', QUERIES.categories);
    }
  });
}

function searchRaffles() {
  group('Search', function () {
    const searchTerm = randomSearchTerm();
    const priceRange = randomPriceRange();

    graphqlQuery('search', QUERIES.rafflesPaginated, {
      filters: {
        searchTerm,
        estado: 'ACTIVA',
        precioMin: priceRange.precioMin,
        precioMax: priceRange.precioMax,
      },
      pagination: { page: 1, limit: 20 },
    });

    sleep(randomThinkTime(3, 7) / 1000);
  });
}

function viewRaffleDetail(raffles) {
  if (raffles.length === 0) {
    sleep(1);
    return;
  }

  group('View Detail', function () {
    const raffle = raffles[Math.floor(Math.random() * raffles.length)];

    graphqlQuery('detail', QUERIES.raffle, { id: raffle.id });
    sleep(randomThinkTime(5, 15) / 1000);

    // Increment view
    graphqlQuery('views', MUTATIONS.incrementRaffleViews, { raffleId: raffle.id });

    // Some check seller
    if (Math.random() > 0.7 && raffle.seller?.id) {
      graphqlQuery('seller', QUERIES.sellerProfile, { id: raffle.seller.id });
      sleep(randomThinkTime(3, 8) / 1000);
    }
  });
}

function authenticatedActions(token, raffles) {
  if (!token) {
    // Fallback to just logging in
    login(TEST_USERS.buyer.email, TEST_USERS.buyer.password);
    sleep(2);
    return;
  }

  group('Authenticated', function () {
    // Check profile
    graphqlQuery('me', QUERIES.me, {}, token);
    sleep(randomThinkTime(1, 2) / 1000);

    // Get tickets
    graphqlQuery('tickets', QUERIES.myTickets, {}, token);
    sleep(randomThinkTime(2, 4) / 1000);

    // Buyer stats
    if (Math.random() > 0.5) {
      graphqlQuery('stats', QUERIES.buyerStats, {}, token);
    }
  });
}

function healthCheck() {
  group('Health', function () {
    http.get(`${BASE_URL}/health/live`);
    sleep(0.5);
  });
}

export function handleSummary(data) {
  const metrics = data.metrics;

  console.log('\n========================================');
  console.log('LOAD TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Requests: ${metrics.http_reqs?.values?.count || 0}`);
  console.log(`Failed Rate: ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%`);
  console.log(`Avg Duration: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms`);
  console.log(`P95 Duration: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms`);
  console.log(`P99 Duration: ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms`);
  console.log('========================================\n');

  return {};
}
