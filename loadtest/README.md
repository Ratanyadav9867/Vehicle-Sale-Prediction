# Load Testing & High-Concurrency Benchmarks

This directory contains k6 load testing scenarios and Python concurrent benchmark runners for the Car Worth application.

## Prerequisites

- [k6](https://k6.io/) installed (for running `.js` test scripts).
- Python 3.10+ (for `run_benchmark.py`).

## Required Environment Variables

Before running authenticated load test scenarios (`k6-predict.js`, `k6-mixed-10k.js`, or `run_benchmark.py`), you must configure credentials for the test user:

```bash
export LOAD_TEST_EMAIL="loadtest@example.com"
export LOAD_TEST_PASSWORD="YourSecurePassword#123"
export TARGET_URL="http://127.0.0.1:8000"
```

Or pass them inline using k6's `-e` flag:

```bash
# Run prediction endpoint load test
k6 run -e LOAD_TEST_EMAIL="loadtest@example.com" -e LOAD_TEST_PASSWORD="YourSecurePassword#123" -e TARGET_URL="http://127.0.0.1:8000" loadtest/k6-predict.js

# Run 10,000 mixed-traffic stress test
k6 run -e LOAD_TEST_EMAIL="loadtest@example.com" -e LOAD_TEST_PASSWORD="YourSecurePassword#123" -e TARGET_URL="http://127.0.0.1:8000" loadtest/k6-mixed-10k.js
```

## Available Scripts

| Script | Purpose | Authentication |
| :--- | :--- | :--- |
| `k6-landing.js` | Unauthenticated public page & options traffic | No |
| `k6-auth.js` | User registration & session validation loops | Generates virtual users dynamically |
| `k6-predict.js` | Prediction cache hits & ML inference under load | Requires `LOAD_TEST_EMAIL` & `LOAD_TEST_PASSWORD` |
| `k6-mixed-10k.js` | Full distributed traffic simulation (10k VUs) | Requires `LOAD_TEST_EMAIL` & `LOAD_TEST_PASSWORD` |
| `run_benchmark.py`| Python multi-threaded benchmark suite | Registers dynamic pool / requires credentials |

## Running the Python Benchmark

```bash
python loadtest/run_benchmark.py
```
*(Optionally set `LOAD_TEST_EMAIL` and `LOAD_TEST_PASSWORD` in your environment or `.env` file).*
