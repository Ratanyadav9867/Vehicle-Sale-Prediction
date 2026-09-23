import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '1m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8000';

export default function () {
  const rand = Math.floor(Math.random() * 10000000);
  const email = `testuser_${rand}@example.com`;
  const password = 'Password@123';

  // 1. Register User
  const regPayload = JSON.stringify({
    name: `User ${rand}`,
    email: email,
    password: password,
    confirm_password: password,
  });

  const regRes = http.post(`${BASE_URL}/api/auth/register`, regPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(regRes, {
    'register status is 201': (r) => r.status === 201,
  });

  if (regRes.status === 201) {
    const token = JSON.parse(regRes.body).token;

    // 2. Validate Session
    const meRes = http.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(meRes, {
      'me status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
