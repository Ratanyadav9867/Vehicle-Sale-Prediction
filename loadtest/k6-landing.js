import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 500 },
    { duration: '1m', target: 2000 },
    { duration: '1m', target: 5000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete below 300ms
    http_req_failed: ['rate<0.01'],    // Error rate must be under 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8000';

export default function () {
  // Test health check and options
  const healthRes = http.get(`${BASE_URL}/healthz`);
  check(healthRes, {
    'healthz is 200': (r) => r.status === 200,
  });

  const optionsRes = http.get(`${BASE_URL}/api/options`);
  check(optionsRes, {
    'options status is 200': (r) => r.status === 200,
    'has fuel types': (r) => r.body.includes('Petrol'),
  });

  sleep(1);
}
