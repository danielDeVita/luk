// Stress test - Find the breaking point of the system
// Gradually increases load until failures occur
import { sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL } from './config/options.js';
import { graphqlQuery, QUERIES, MUTATIONS } from './helpers/graphql.js';
import { randomSearchTerm, randomPagination, randomSortBy } from './helpers/data.js';
import { randomThinkTime } from './config/options.js';
import http from 'k6/http';
import { check } from 'k6';

// Custom metrics for stress testing
const errorCount = new Counter('stress_errors');
const responseTime = new Trend('stress_response_time');

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Warm-up
        { duration: '2m', target: 50 },
        // Normal load
        { duration: '3m', target: 50 },
        // Ramp up to stress
        { duration: '2m', target: 100 },
        // Hold stress
        { duration: '3m', target: 100 },
        // Push to breaking point
        { duration: '2m', target: 200 },
        // Hold extreme load
        { duration: '3m', target: 200 },
        // Recovery
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    // More lenient thresholds for stress test
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'], // Allow up to 10% failures
    stress_errors: ['count<1000'], // Track total errors
  },
};

let raffleIds = [];

export function setup() {
  const result = graphqlQuery('setup', QUERIES.rafflesPaginated, {
    filters: { estado: 'ACTIVA' },
    pagination: { page: 1, limit: 100 },
  });

  if (result?.data?.rafflesPaginated?.items) {
    raffleIds = result.data.rafflesPaginated.items.map((r) => r.id);
  }

  return { raffleIds };
}

export default function (data) {
  const { raffleIds } = data;
  const startTime = Date.now();

  try {
    // Mix of operations with focus on read-heavy workload
    const operation = Math.random();

    if (operation < 0.50) {
      // 50% - Browse (most common)
      stressBrowse();
    } else if (operation < 0.75) {
      // 25% - Search (CPU intensive)
      stressSearch();
    } else if (operation < 0.90) {
      // 15% - Detail view
      stressDetail(raffleIds);
    } else {
      // 10% - Health check
      stressHealth();
    }
  } catch (e) {
    errorCount.add(1);
    console.log('Stress error:', e.message);
  }

  responseTime.add(Date.now() - startTime);

  // Minimal think time under stress
  sleep(randomThinkTime(0.5, 2) / 1000);
}

function stressBrowse() {
  group('stress_browse', function () {
    const result = graphqlQuery('browse', QUERIES.rafflesPaginated, {
      filters: { estado: 'ACTIVA', sortBy: randomSortBy() },
      pagination: randomPagination(),
    });

    if (!result || result.errors) {
      errorCount.add(1);
    }
  });
}

function stressSearch() {
  group('stress_search', function () {
    const result = graphqlQuery('search', QUERIES.rafflesPaginated, {
      filters: {
        searchTerm: randomSearchTerm(),
        estado: 'ACTIVA',
      },
      pagination: { page: 1, limit: 20 },
    });

    if (!result || result.errors) {
      errorCount.add(1);
    }
  });
}

function stressDetail(raffleIds) {
  if (raffleIds.length === 0) return;

  group('stress_detail', function () {
    const id = raffleIds[Math.floor(Math.random() * raffleIds.length)];
    const result = graphqlQuery('detail', QUERIES.raffle, { id });

    if (!result || result.errors) {
      errorCount.add(1);
    }

    // Also increment views
    graphqlQuery('views', MUTATIONS.incrementRaffleViews, { raffleId: id });
  });
}

function stressHealth() {
  group('stress_health', function () {
    const response = http.get(`${BASE_URL}/health/live`);
    check(response, {
      'health ok': (r) => r.status === 200,
    });

    if (response.status !== 200) {
      errorCount.add(1);
    }
  });
}

export function handleSummary(data) {
  const metrics = data.metrics;

  console.log('\n========================================');
  console.log('STRESS TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Requests: ${metrics.http_reqs?.values?.count || 0}`);
  console.log(`Failed Rate: ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%`);
  console.log(`Total Errors: ${metrics.stress_errors?.values?.count || 0}`);
  console.log('');
  console.log('Response Times:');
  console.log(`  Min: ${(metrics.http_req_duration?.values?.min || 0).toFixed(2)}ms`);
  console.log(`  Avg: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms`);
  console.log(`  Med: ${(metrics.http_req_duration?.values?.med || 0).toFixed(2)}ms`);
  console.log(`  P90: ${(metrics.http_req_duration?.values['p(90)'] || 0).toFixed(2)}ms`);
  console.log(`  P95: ${(metrics.http_req_duration?.values['p(95)'] || 0).toFixed(2)}ms`);
  console.log(`  P99: ${(metrics.http_req_duration?.values['p(99)'] || 0).toFixed(2)}ms`);
  console.log(`  Max: ${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms`);
  console.log('');

  // Determine if test passed
  const failRate = metrics.http_req_failed?.values?.rate || 0;
  const p95 = metrics.http_req_duration?.values['p(95)'] || 0;

  if (failRate < 0.05 && p95 < 1000) {
    console.log('STATUS: PASSED - System handled stress well');
  } else if (failRate < 0.10 && p95 < 2000) {
    console.log('STATUS: WARNING - System showing strain');
  } else {
    console.log('STATUS: FAILED - System could not handle load');
  }

  console.log('========================================\n');

  return {};
}
