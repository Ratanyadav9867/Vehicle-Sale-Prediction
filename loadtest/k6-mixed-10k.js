import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 2500 },
    { duration: '3m', target: 10000 },
    { duration: '10m', target: 10000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'], // API p95 < 500ms, prediction p95 < 1.5s
    http_req_failed: ['rate<0.01'],                  // Error rate < 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8000';

export function setup() {
  const email = (typeof __ENV !== 'undefined' && __ENV.LOAD_TEST_EMAIL) || (typeof process !== 'undefined' && process.env && process.env.LOAD_TEST_EMAIL);
  const password = (typeof __ENV !== 'undefined' && __ENV.LOAD_TEST_PASSWORD) || (typeof process !== 'undefined' && process.env && process.env.LOAD_TEST_PASSWORD);

  if (!email || !password) {
    throw new Error('LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD environment variables are required. Set them before running k6 (e.g. k6 run -e LOAD_TEST_EMAIL=... -e LOAD_TEST_PASSWORD=... loadtest/k6-mixed-10k.js)');
  }

  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: email,
    password: password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 200) {
    return { token: JSON.parse(res.body).token };
  }
  throw new Error(`Authentication failed for ${email} with status ${res.status}: ${res.body}`);
}

export default function (data) {
  const roll = Math.random();

  if (roll < 0.50) {
    // 50% traffic: Read-only static options, landing metadata, and health probes
    const res = http.get(`${BASE_URL}/api/options`);
    check(res, { 'options 200': (r) => r.status === 200 });
  } else if (roll < 0.70) {
    // 20% traffic: Batched client telemetry events
    const batchPayload = JSON.stringify({
      events: [
        {
          action_type: 'page_view',
          category: 'navigation',
          description: 'User viewed landing page',
          metadata: { path: '/' },
        },
      ],
    });
    const res = http.post(`${BASE_URL}/api/logs/batch`, batchPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'batch logs 201': (r) => r.status === 201 });
  } else {
    // 30% traffic: Price valuation with Redis cache & threadpool execution
    const predPayload = JSON.stringify({
      brand: 'Innova',
      year: 2016,
      present_price: 18.5,
      kms_driven: 65000,
      fuel_type: 'Diesel',
      seller_type: 'Dealer',
      transmission: 'Manual',
      owner: 0,
    });
    const res = http.post(`${BASE_URL}/api/predict`, predPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.token}`,
      },
    });
    check(res, { 'predict 200': (r) => r.status === 200 });
  }

  sleep(Math.random() * 2 + 1); // 1-3 second user think time
}
