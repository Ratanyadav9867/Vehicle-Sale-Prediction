import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 500 },
    { duration: '2m', target: 2000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // Cache + threadpool ensures p95 < 500ms
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8000';
let authToken = null;

export function setup() {
  const email = (typeof __ENV !== 'undefined' && __ENV.LOAD_TEST_EMAIL) || (typeof process !== 'undefined' && process.env && process.env.LOAD_TEST_EMAIL);
  const password = (typeof __ENV !== 'undefined' && __ENV.LOAD_TEST_PASSWORD) || (typeof process !== 'undefined' && process.env && process.env.LOAD_TEST_PASSWORD);

  if (!email || !password) {
    throw new Error('LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD environment variables are required. Set them before running k6 (e.g. k6 run -e LOAD_TEST_EMAIL=... -e LOAD_TEST_PASSWORD=... loadtest/k6-predict.js)');
  }

  // Login as load-test user to get auth token
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
  const token = data.token;
  const payload = JSON.stringify({
    brand: 'City',
    year: 2017,
    present_price: 9.5,
    kms_driven: 32000,
    fuel_type: 'Petrol',
    seller_type: 'Dealer',
    transmission: 'Manual',
    owner: 0,
  });

  const res = http.post(`${BASE_URL}/api/predict`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    'predict status is 200': (r) => r.status === 200,
    'has predicted price': (r) => JSON.parse(r.body).predicted_price > 0,
  });

  sleep(0.5);
}
