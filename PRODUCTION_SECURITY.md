# Production Security Architecture & Deployment Guide (PRODUCTION_SECURITY.md)

**Platform:** Vehicle Sale Prediction Platform  
**Target:** Enterprise Production Deployment  
**Standard:** OWASP Application Security Verification Standard (ASVS) 5.0  
**Status:** Validated & Hardened  

---

## 1. Secrets Management & Zero Hardcoded Credentials

Production systems strictly prohibit embedding credentials or default passwords in source code, orchestration templates, or Dockerfiles.

### 1.1 Secret Injection Protocol
- All production configuration is supplied via runtime environment variables injected from enterprise secret management systems (e.g. AWS Secrets Manager, HashiCorp Vault, Kubernetes Secrets).
- Templates ([`.env.example`](file:///c:/Users/R/vehicle%20sale%20prediction/.env.example)) contain only empty placeholders without default or pseudo-credentials.
- Compose files ([`docker-compose.yml`](file:///c:/Users/R/vehicle%20sale%20prediction/docker-compose.yml)) reference variables directly:
  ```yaml
  environment:
    - DATABASE_URL=${DATABASE_URL}
    - JWT_SECRET=${JWT_SECRET}
    - ADMIN_EMAIL=${ADMIN_EMAIL}
    - ADMIN_PASSWORD=${ADMIN_PASSWORD}
  ```

### 1.2 Startup Secret Validation
Upon startup in `ENVIRONMENT=production`, the application executes `validate_production_secrets()` ([`backend/utils/security_config.py`](file:///c:/Users/R/vehicle%20sale%20prediction/backend/utils/security_config.py)). The process **aborts immediately** (raising `RuntimeError`) if:
- `JWT_SECRET` is missing, less than 32 characters, or contains known weak strings (`changeme`, `secret`, `admin`, `123456`, `replace-me`, etc.).
- `ADMIN_PASSWORD` is trivially weak or contains placeholder strings.
- `DATABASE_URL` contains default credentials (e.g. `carpass`).
- `DEBUG` is set to `true`.

---

## 2. HTTPS / TLS & Trusted Reverse Proxy Architecture

### 2.1 Edge TLS Termination
- In production, TLS is terminated at the edge reverse proxy (e.g., Cloudflare, AWS ALB, Nginx).
- Plaintext HTTP requests received by Nginx forwarded with `X-Forwarded-Proto: http` are immediately redirected with `301 Moved Permanently` to `https://$host$request_uri`.
- The `Strict-Transport-Security` (HSTS) header is conditionally added with a 2-year duration (`max-age=63072000; includeSubDomains`) on all HTTPS traffic.

### 2.2 Client IP Resolution & Spoofing Mitigation
- Client IP resolution ([`backend/utils/auth_deps.py`](file:///c:/Users/R/vehicle%20sale%20prediction/backend/utils/auth_deps.py)) inspects `X-Forwarded-For` **only** if the direct TCP peer matches an IP configured in `TRUSTED_PROXY_IPS`.
- If an unknown peer transmits `X-Forwarded-For`, the header is disregarded and the direct TCP address is used, preventing IP-spoofing rate-limit bypasses.

---

## 3. Session Security & Cookie Policies

### 3.1 Cookie Prefixes & Storage
- In production environments (`ENVIRONMENT=production` and `COOKIE_SECURE=true`), session cookies are issued using the **`__Host-` prefix**:
  ```http
  Set-Cookie: __Host-auth_token=<TOKEN>; Path=/; Secure; HttpOnly; SameSite=Lax
  ```
- Attributes enforced:
  - `Secure`: Transmitted strictly over HTTPS.
  - `HttpOnly`: Inaccessible to browser JavaScript (XSS mitigation).
  - `SameSite=Lax`: Defends against cross-site request forgery while allowing top-level navigation.
  - `Path=/`: Confined to the entire host.

### 3.2 Token Exclusion from Responses
- In production, session tokens are omitted from JSON response bodies (`token=None` in [`backend/schemas/auth.py`](file:///c:/Users/R/vehicle%20sale%20prediction/backend/schemas/auth.py)), ensuring tokens never enter browser DOM or script scopes.
- Session tokens are stored as cryptographic SHA-256 hashes at rest in the database.

---

## 4. Security Headers & Browser Hardening

Both Nginx and FastAPI inject defense-in-depth security headers on all responses:

| Header | Production Directive | Purpose |
| :--- | :--- | :--- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; ...` | Restricts script, style, and object execution to trusted origins. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Mandates browser HTTPS communication for 2 years. |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME-type sniffing. |
| `X-Frame-Options` | `DENY` | Prevents iframe clickjacking attacks. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Protects URL path privacy on outbound navigation. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables device hardware APIs from the origin. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browser browsing context group from cross-origin popups. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Prevents third-party websites from reading API or asset responses. |

---

## 5. Machine Learning Model Integrity

- The serialized pipeline (`ml/models/car_price_model.pkl`) is protected against deserialization tampering attacks.
- Prior to calling `joblib.load()`, [`backend/model/loader.py`](file:///c:/Users/R/vehicle%20sale%20prediction/backend/model/loader.py) calculates the cryptographic SHA-256 digest of the artifact on disk and verifies it against [`ml/models/car_price_model.pkl.sha256`](file:///c:/Users/R/vehicle%20sale%20prediction/ml/models/car_price_model.pkl.sha256).
- If the checksum does not match, startup halts immediately (`ModelIntegrityError`), preventing arbitrary code execution via malicious pickle payloads.

---

## 6. Container & Network Isolation

- **Non-Root Execution:** Containers run as unprivileged `appuser` (UID `1000`).
- **Capability Dropping:** `cap_drop: [ALL]` applied to all container definitions.
- **Privilege Escalation:** `security_opt: [no-new-privileges:true]` enforced across all services.
- **Network Confinement:** PostgreSQL and Redis containers have **no exposed host ports** and communicate solely over internal Docker bridge networks (`app_network`).
- **Resource Ceilings:** Containers define CPU (`cpus: "1.0"`) and RAM limits (`512M` / `1G`) to mitigate denial-of-service and memory exhaustion.

---

## 7. Production Pre-Flight Checklist

Before launching public traffic:

1. [ ] Set `ENVIRONMENT=production`.
2. [ ] Inject random 64-character hex `JWT_SECRET` (`openssl rand -hex 32`).
3. [ ] Set `ADMIN_PASSWORD` to a strong unique credential.
4. [ ] Configure `DATABASE_URL` pointing to hardened PostgreSQL with unique credentials.
5. [ ] Configure `TRUSTED_PROXY_IPS` with the IP addresses of your upstream load balancers.
6. [ ] Ensure TLS certificate is bound to your edge proxy / load balancer.
7. [ ] Confirm `python -m pytest tests/ -v` completes with 100% pass rate.
8. [ ] Verify that public Swagger documentation is disabled (`/docs` returns 404).
