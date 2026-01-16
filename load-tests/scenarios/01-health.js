// Health endpoint load test
// Tests the backend health check endpoints
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, healthThresholds } from '../config/options.js';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: healthThresholds,
};

export default function () {
  // Full health check (includes DB)
  const healthResponse = http.get(`${BASE_URL}/health`);
  check(healthResponse, {
    'health: status is 200': (r) => r.status === 200,
    'health: response time < 100ms': (r) => r.timings.duration < 100,
    'health: status is healthy': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'ok' || body.status === 'healthy';
      } catch {
        return false;
      }
    },
  });

  // Readiness probe (k8s)
  const readyResponse = http.get(`${BASE_URL}/health/ready`);
  check(readyResponse, {
    'ready: status is 200': (r) => r.status === 200,
    'ready: response time < 50ms': (r) => r.timings.duration < 50,
  });

  // Liveness probe (k8s)
  const liveResponse = http.get(`${BASE_URL}/health/live`);
  check(liveResponse, {
    'live: status is 200': (r) => r.status === 200,
    'live: response time < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(0.1); // Small pause between iterations
}
