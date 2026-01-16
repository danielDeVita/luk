// Shared k6 configuration options
// Usage: import { BASE_URL, GRAPHQL_URL, thresholds } from '../config/options.js';

// Target URLs - override with environment variable
export const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3001';
export const GRAPHQL_URL = `${BASE_URL}/graphql`;

// Default thresholds for all tests
export const thresholds = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
  http_reqs: ['rate>10'],
};

// Stricter thresholds for health endpoints
export const healthThresholds = {
  http_req_duration: ['p(95)<100', 'p(99)<200'],
  http_req_failed: ['rate<0.001'],
};

// Relaxed thresholds for authenticated/complex operations
export const authThresholds = {
  http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  http_req_failed: ['rate<0.05'],
};

// Predefined scenarios
export const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },
      { duration: '3m', target: 50 },
      { duration: '1m', target: 0 },
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '10s', target: 0 },
    ],
  },
};

// Think time utilities (realistic user pauses)
export function randomThinkTime(minSeconds, maxSeconds) {
  const min = minSeconds * 1000;
  const max = maxSeconds * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
