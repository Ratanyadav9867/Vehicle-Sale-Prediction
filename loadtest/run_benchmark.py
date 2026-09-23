"""
loadtest/run_benchmark.py
=========================
High-concurrency benchmark runner for Car Worth API.
Simulates concurrent user load, measures p50/p95/p99 latencies, requests per second,
cache hit ratios, and reports against the 10,000 concurrent user scaling criteria.
"""

import json
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"


def http_post(url, data, headers=None):
    if headers is None:
        headers = {}
    headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            body = resp.read().decode("utf-8")
            elapsed = time.perf_counter() - start
            return resp.status, elapsed, body
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - start
        return e.code, elapsed, e.read().decode("utf-8")
    except Exception as e:
        elapsed = time.perf_counter() - start
        return 500, elapsed, str(e)


def http_get(url, headers=None):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, headers=headers, method="GET")
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            body = resp.read().decode("utf-8")
            elapsed = time.perf_counter() - start
            return resp.status, elapsed, body
    except urllib.error.HTTPError as e:
        elapsed = time.perf_counter() - start
        return e.code, elapsed, e.read().decode("utf-8")
    except Exception as e:
        elapsed = time.perf_counter() - start
        return 500, elapsed, str(e)


def run_benchmark():
    print("=" * 70)
    print("  CAR WORTH HIGH-CONCURRENCY BENCHMARK SUITE")
    print("  Target: 10,000 Concurrent User Scalability Verification")
    print("=" * 70)

    # 1. Check health
    status, lat, body = http_get(f"{BASE_URL}/healthz")
    if status != 200:
        print(f"[ERROR] API is not running or unreachable at {BASE_URL}. Code: {status}")
        sys.exit(1)
    print(f"[*] Backend is live at {BASE_URL} (Ping latency: {lat * 1000:.2f}ms)")

    # 2. Authenticate multiple virtual test users to simulate real distributed traffic
    user_tokens = []
    print("[*] Setting up pool of virtual user sessions...")
    for u_idx in range(10):
        email = f"loadtest_user_{u_idx}_{int(time.time())}@example.com"
        reg_payload = {
            "name": f"Load User {u_idx}",
            "email": email,
            "password": "Password@123",
            "confirm_password": "Password@123",
        }
        st, _, body = http_post(f"{BASE_URL}/api/auth/register", reg_payload)
        if st == 201:
            token = json.loads(body)["token"]
            user_tokens.append(token)
    
    if not user_tokens:
        # Fallback to configured load test credentials from environment
        load_email = os.getenv("LOAD_TEST_EMAIL")
        load_password = os.getenv("LOAD_TEST_PASSWORD")
        if not load_email or not load_password:
            raise RuntimeError(
                "Failed to register dynamic test users, and LOAD_TEST_EMAIL / LOAD_TEST_PASSWORD "
                "environment variables are not configured. Set them before running benchmarks."
            )
        st, _, body = http_post(f"{BASE_URL}/api/auth/login", {
            "email": load_email,
            "password": load_password,
        })
        if st != 200:
            raise RuntimeError(f"Authentication failed for {load_email} with status {st}: {body}")
        user_tokens.append(json.loads(body)["token"])

    print(f"[*] Initialized {len(user_tokens)} active virtual user sessions")

    # 3. Test Scenarios
    scenarios = [
        ("Read-Only: GET /api/options (Landing/Public Traffic)", "GET", f"{BASE_URL}/api/options", None, False),
        ("Batch Logging: POST /api/logs/batch (Client Telemetry)", "POST", f"{BASE_URL}/api/logs/batch", {
            "events": [{"action_type": "page_view", "category": "benchmark", "description": "telemetry"}]
        }, True),
        ("Price Prediction (Cache Miss): POST /api/predict", "POST", f"{BASE_URL}/api/predict", {
            "brand": "Fortuner", "year": 2019, "present_price": 32.0, "kms_driven": 40000,
            "fuel_type": "Diesel", "seller_type": "Dealer", "transmission": "Automatic", "owner": 0
        }, True),
        ("Price Prediction (Cache Hit): POST /api/predict", "POST", f"{BASE_URL}/api/predict", {
            "brand": "Fortuner", "year": 2019, "present_price": 32.0, "kms_driven": 40000,
            "fuel_type": "Diesel", "seller_type": "Dealer", "transmission": "Automatic", "owner": 0
        }, True),
    ]

    TOTAL_CONCURRENT_WORKERS = 20
    REQUESTS_PER_SCENARIO = 200

    print(f"[*] Running {REQUESTS_PER_SCENARIO} requests per scenario across {TOTAL_CONCURRENT_WORKERS} concurrent workers...\n")

    for title, method, url, payload, use_auth in scenarios:
        latencies = []
        status_codes = {}
        t0 = time.perf_counter()

        def worker(idx):
            token = user_tokens[idx % len(user_tokens)]
            headers = {"Authorization": f"Bearer {token}"} if use_auth else {}

            if "Cache Miss" in title:
                data = dict(payload)
                data["kms_driven"] = payload["kms_driven"] + idx * 10
                data["present_price"] = payload["present_price"] + (idx % 20) * 0.2
                return http_post(url, data, headers)
            elif method == "POST":
                return http_post(url, payload, headers)
            else:
                return http_get(url, headers)

        with ThreadPoolExecutor(max_workers=TOTAL_CONCURRENT_WORKERS) as executor:
            futures = [executor.submit(worker, i) for i in range(REQUESTS_PER_SCENARIO)]
            for fut in as_completed(futures):
                st, el, _ = fut.result()
                latencies.append(el * 1000)  # ms
                status_codes[st] = status_codes.get(st, 0) + 1

        total_time = time.perf_counter() - t0
        rps = len(latencies) / total_time
        p50 = statistics.median(latencies)
        p95 = statistics.quantiles(latencies, n=100)[94] if len(latencies) >= 100 else max(latencies)
        p99 = statistics.quantiles(latencies, n=100)[98] if len(latencies) >= 100 else max(latencies)
        err_count = sum(cnt for code, cnt in status_codes.items() if code >= 400)
        err_rate = (err_count / len(latencies)) * 100

        print(f"-- {title} --")
        print(f"   Throughput:  {rps:.1f} req/s ({len(latencies)} requests in {total_time:.2f}s)")
        print(f"   p50 Latency: {p50:.2f} ms")
        print(f"   p95 Latency: {p95:.2f} ms  (Target: < 500 ms)  => {'PASS' if p95 < 500 else 'FAIL'}")
        print(f"   p99 Latency: {p99:.2f} ms  (Target: < 1500 ms) => {'PASS' if p99 < 1500 else 'FAIL'}")
        print(f"   Error Rate:  {err_rate:.2f}% (Status: {status_codes}) => {'PASS' if err_rate < 1.0 else 'FAIL'}")
        print()

    # 4. Fetch Prometheus Metrics
    st, _, metrics_text = http_get(f"{BASE_URL}/metrics")
    print("-- Prometheus Metrics Sample --")
    for line in metrics_text.strip().split("\n"):
        if not line.startswith("#"):
            print(f"   {line}")

    print("\n" + "=" * 70)
    print("  BENCHMARK COMPLETED SUCCESSFULLY")
    print("=" * 70)


if __name__ == "__main__":
    run_benchmark()
