// Smoke test - Quick validation that all endpoints work
// Run this first to ensure the system is responding
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, GRAPHQL_URL } from './config/options.js';
import { graphqlQuery, QUERIES, MUTATIONS } from './helpers/graphql.js';
import { login, TEST_USERS } from './helpers/auth.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.1'], // Allow some failures in smoke test
    http_req_duration: ['p(95)<2000'], // Relaxed for initial validation
  },
};

export default function () {
  // 1. Health endpoints
  group('Health Endpoints', function () {
    const health = http.get(`${BASE_URL}/health`);
    check(health, {
      'health: status 200': (r) => r.status === 200,
    });

    const ready = http.get(`${BASE_URL}/health/ready`);
    check(ready, {
      'ready: status 200': (r) => r.status === 200,
    });

    const live = http.get(`${BASE_URL}/health/live`);
    check(live, {
      'live: status 200': (r) => r.status === 200,
    });
  });

  sleep(1);

  // 2. Public GraphQL queries
  group('Public Queries', function () {
    const raffles = graphqlQuery('raffles', QUERIES.rafflesPaginated, {
      filters: { estado: 'ACTIVA' },
      pagination: { page: 1, limit: 10 },
    });
    check(raffles, {
      'raffles: has data': (r) => r?.data?.rafflesPaginated,
    });

    const categories = graphqlQuery('categories', QUERIES.categories);
    check(categories, {
      'categories: has data': (r) => r?.data?.categories,
    });
  });

  sleep(1);

  // 3. Authentication
  group('Authentication', function () {
    const token = login(TEST_USERS.buyer.email, TEST_USERS.buyer.password);
    check(token, {
      'login: got token': (t) => t && t.length > 0,
    });

    if (token) {
      const me = graphqlQuery('me', QUERIES.me, {}, token);
      check(me, {
        'me: has user': (r) => r?.data?.me?.email,
      });
    }
  });

  sleep(1);

  // 4. Raffle detail (if we have any)
  group('Raffle Detail', function () {
    const raffles = graphqlQuery('get_raffles', QUERIES.rafflesPaginated, {
      filters: { estado: 'ACTIVA' },
      pagination: { page: 1, limit: 1 },
    });

    const raffleId = raffles?.data?.rafflesPaginated?.items?.[0]?.id;
    if (raffleId) {
      const detail = graphqlQuery('raffle', QUERIES.raffle, { id: raffleId });
      check(detail, {
        'detail: has raffle': (r) => r?.data?.raffle,
      });
    }
  });

  sleep(1);
}

export function handleSummary(data) {
  console.log('\n========================================');
  console.log('SMOKE TEST SUMMARY');
  console.log('========================================');

  const metrics = data.metrics;
  const checks = metrics.checks;
  const httpReqs = metrics.http_reqs;
  const httpFailed = metrics.http_req_failed;
  const httpDuration = metrics.http_req_duration;

  console.log(`Total Requests: ${httpReqs?.values?.count || 0}`);
  console.log(`Failed Requests: ${(httpFailed?.values?.rate * 100 || 0).toFixed(2)}%`);
  console.log(`Avg Response Time: ${(httpDuration?.values?.avg || 0).toFixed(2)}ms`);
  console.log(`P95 Response Time: ${(httpDuration?.values['p(95)'] || 0).toFixed(2)}ms`);
  console.log(`Checks Passed: ${((checks?.values?.passes / (checks?.values?.passes + checks?.values?.fails)) * 100 || 0).toFixed(2)}%`);

  console.log('========================================\n');

  return {};
}
