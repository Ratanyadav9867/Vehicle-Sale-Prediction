# Security Testing & Verification Guide (SECURITY_TESTING.md)

**Platform:** Vehicle Sale Prediction Platform  
**Target:** Production-Grade Security Verification  
**Auditor / Engineer:** Senior Application Security & DevSecOps Engineer  
**Date:** September 2026  
**Status:** All 104 Automated Tests Passing (100% Pass Rate)

---

## 1. Executive Summary

This document specifies the automated security testing architecture, test cases, attack simulation methodologies, and execution results for the Vehicle Sale Prediction Platform.

Every security control introduced during the DevSecOps hardening program is validated by automated regression tests in the test suite. No security feature is accepted on assertion alone: each is subjected to automated attack simulation.

---

## 2. Test Execution Quick Start

### 2.1 Backend Security & Unit Test Suite

Run all automated unit, integration, and security tests:

```bash
# Run the entire test suite with verbose output
python -m pytest tests/ -v

# Run the dedicated security audit test suite only
python -m pytest tests/test_security_audit.py -v
```

### 2.2 Frontend Quality & Dependency Audit

Validate frontend production build and scan for vulnerable dependencies:

```bash
# Verify frontend compiles with zero TypeScript or bundling errors
npm run build

# Perform dependency vulnerability audit
npm audit
```

### 2.3 Continuous Integration (CI/CD)

The test suite is automatically executed on every pull request and push to `main` via GitHub Actions (`.github/workflows/security.yml`). The workflow enforces:
- Pytest execution across all test modules
- Code formatting and lint verification (`ruff`)
- Node.js dependency vulnerability auditing (`npm audit`)
- Frontend production compilation (`npm run build`)
- Dockerfile build validation with Buildx caching

---

## 3. Security Audit Test Suite Breakdown (`tests/test_security_audit.py`)

The dedicated security audit test module (`tests/test_security_audit.py`) simulates 17 distinct real-world attack vectors against the live FastAPI application:

| Test Function | Attack Vector / Scenario | Expected Security Response | Test Status |
| :--- | :--- | :--- | :---: |
| `test_unauthenticated_predict_rejected` | Unauthenticated user attempts vehicle price prediction (`POST /api/predict`). | HTTP `401 Unauthorized` | **PASSED** |
| `test_unauthorized_admin_access_rejected` | Normal authenticated user attempts administrative endpoint (`GET /api/admin/users`). | HTTP `403 Forbidden` (`detail: "Admin privileges required"`) | **PASSED** |
| `test_session_token_stored_as_sha256_hash` | Database compromise / backup leak inspection on `sessions` table. | Raw token is NOT found in `sessions` table; only SHA-256 hex digest is stored. | **PASSED** |
| `test_revoked_session_rejected` | Attacker uses a revoked / logged-out session bearer or cookie token. | HTTP `401 Unauthorized` | **PASSED** |
| `test_expired_session_rejected` | Attacker presents a session past its expiration timestamp. | HTTP `401 Unauthorized` | **PASSED** |
| `test_brute_force_lockout_throttling` | Rapid automated credential stuffing / dictionary attack (6 consecutive failed logins). | Rate limiter triggers; subsequent attempt returns HTTP `429 Too Many Requests`. | **PASSED** |
| `test_csrf_protection_missing_header_rejected` | Malicious cross-origin website triggers state-changing `PUT /api/auth/profile` with ambient cookie but without `X-CSRF-Token`. | HTTP `403 Forbidden` (`detail: "CSRF token missing or invalid"`) | **PASSED** |
| `test_csrf_protection_mismatched_token_rejected` | Attacker attempts to forge `X-CSRF-Token` with an arbitrary attacker-controlled value. | HTTP `403 Forbidden` | **PASSED** |
| `test_csrf_protection_valid_token_accepted` | Legitimate SPA client provides matching `csrf_token` cookie and `X-CSRF-Token` header. | Request succeeds; HTTP `200 OK` | **PASSED** |
| `test_cors_unauthorized_origin_rejected` | Attacker script hosted at `https://evil-hacker.com` sends preflight `OPTIONS` request. | Response does NOT include `Access-Control-Allow-Origin: https://evil-hacker.com`. | **PASSED** |
| `test_sql_injection_payload_parameterization` | SQL injection strings (`admin' OR '1'='1' --`) injected into login and query parameters. | Handled strictly as literal string parameters; zero syntax or injection execution. | **PASSED** |
| `test_path_traversal_on_ticket_attachment_rejected` | Attacker injects directory traversal sequences (`../../../../etc/passwd`, `..\..\..\windows\win.ini`) into attachment endpoints. | Path traversal detected; returns HTTP `400 Bad Request` or `404 Not Found`. | **PASSED** |
| `test_oversized_payload_rejected` | Resource exhaustion / DoS attack via 11 MB request body exceeding 10 MB limit. | HTTP `413 Request Entity Too Large` | **PASSED** |
| `test_input_validation_invalid_year_rejected` | Client sends vehicle year outside valid bounds (`year=2099` or `year=1800`). | HTTP `422 Unprocessable Entity` | **PASSED** |
| `test_input_validation_negative_mileage_rejected` | Client sends negative kilometers driven (`kms_driven=-5000`). | HTTP `422 Unprocessable Entity` | **PASSED** |
| `test_security_headers_present` | Inspection of HTTP response headers for missing browser security controls. | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP. | **PASSED** |
| `test_model_sha256_checksum_verification` | Supply-chain attack simulation: model file modified or mismatched SHA-256 hash provided. | `ModelStore.load()` raises `ValueError("Model integrity check failed")`. | **PASSED** |

---

## 4. Complete Test Suite Catalog (104 Tests)

In addition to `test_security_audit.py`, the existing test modules validate business logic, input validation, and core platform capabilities:

1. **`tests/test_auth.py` (22 tests):**
   - Registration with strong password validation (min 8 chars, uppercase, lowercase, digit, special character).
   - Duplicate email registration rejection.
   - Authentication with valid/invalid credentials.
   - Timing-attack mitigation (dummy hashing on nonexistent user).
   - Token issuance and profile retrieval (`/api/auth/me`).
   - Profile updating and password change validation.
   - Cookie setting with `HttpOnly`, `SameSite=Lax`, and `Secure` attributes.

2. **`tests/test_predict.py` (24 tests):**
   - Machine learning inference pipeline end-to-end.
   - Pydantic schema validation for all feature fields (Car_Name, Year, Present_Price, Kms_Driven, Fuel_Type, Seller_Type, Transmission, Owner).
   - Prediction history storage and per-user isolation.
   - Guest vs. authenticated prediction logic.
   - Prediction accuracy and depreciation boundary checks.

3. **`tests/test_admin.py` (19 tests):**
   - Admin RBAC gating (`require_admin_user`).
   - User listing, status toggling, and role modification.
   - Self-demotion and self-deletion prevention for active admins.
   - Platform statistics and aggregate metric calculation.
   - Audit log querying and filtration.

4. **`tests/test_change_password.py` (8 tests):**
   - Password change with current password verification.
   - Prevention of reusing old passwords.
   - Active session revocation on password update.

5. **`tests/test_rate_limiter.py` (7 tests):**
   - In-memory sliding-window rate limiting.
   - Per-IP request bucket throttling.
   - Burst handling and recovery after window expiry.

6. **`tests/test_support.py` (7 tests):**
   - Support ticket creation and retrieval.
   - Attachment upload validation with MIME detection and extension whitelisting.
   - Path traversal prevention.

---

## 5. Verification Results Log

### 5.1 Pytest Execution Output
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.3.4, pluggy-1.5.0
rootdir: c:\Users\R\vehicle sale prediction
configfile: pyproject.toml
collected 104 items

tests/test_admin.py ...................                                  [ 18%]
tests/test_auth.py ......................                                [ 39%]
tests/test_change_password.py ........                                   [ 47%]
tests/test_predict.py ........................                           [ 70%]
tests/test_rate_limiter.py .......                                       [ 76%]
tests/test_security_audit.py .................                           [ 93%]
tests/test_support.py .......                                            [100%]

============================= 104 passed in 3.42s =============================
```

### 5.2 Frontend Build & Dependency Audit Output
```text
> frontend@0.0.0 build
> tsc -b && vite build

vite v5.4.14 building for production...
transforming...
✓ 1832 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.82 kB │ gzip:   0.44 kB
dist/assets/index-BbV67uQe.css   31.20 kB │ gzip:   6.15 kB
dist/assets/index-D1o6k3qT.js   342.18 kB │ gzip: 108.42 kB
✓ built in 2.22s

found 0 vulnerabilities
```

---

## 6. Security Regression Protocol

Prior to any production deployment or merger of feature branches, engineers must execute:

1. `python -m pytest tests/ -v` (Must achieve 100% pass rate).
2. `npm run build` (Must complete with 0 TypeScript/bundling errors).
3. `npm audit` (Must report 0 High or Critical vulnerabilities).
4. Inspect `git diff` to guarantee no secrets, credentials, or `.env` files are committed.
