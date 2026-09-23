# Security Policy (SECURITY.md)

**Project:** Vehicle Sale Prediction Platform  
**Repository:** [https://github.com/Ratanyadav9867/Vehicle-Sale-Prediction](https://github.com/Ratanyadav9867/Vehicle-Sale-Prediction)  
**Standard:** OWASP ASVS 5.0 Baseline  
**Last Updated:** September 2026  

---

## 1. Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported | Security Maintenance Status |
| :--- | :---: | :--- |
| `2.1.x` (current `main`) | :white_check_mark: | Active production-hardened release |
| `< 2.1.0` | :x: | End of life (upgrade immediately) |

---

## 2. Reporting a Vulnerability

We welcome coordinated vulnerability disclosures from security researchers, penetration testers, and the DevSecOps community.

### 2.1 Submission Guidelines
- **Do NOT create public GitHub issues** for suspected or confirmed security vulnerabilities.
- Submit reports privately via GitHub Security Advisories:
  - Navigate to **Security** -> **Advisories** -> **Report a vulnerability**.
  - Alternatively, email: `security@vehicleai.example.com` (or the repository administrator).

### 2.2 Report Details
Please include:
1. Target component / endpoint (e.g. `/api/predict`, `auth_deps.py`, Docker configuration).
2. Vulnerability classification (OWASP ASVS 5.0 requirement or CWE identifier).
3. Step-by-step reproduction steps or minimal Proof-of-Concept (PoC).
4. Potential business or security impact (e.g. privilege escalation, authentication bypass).
5. Suggested remediation if available.

### 2.3 Response SLA
- **Initial Acknowledgment:** Within 24 hours of receipt.
- **Triage & Assessment:** Within 72 hours.
- **Remediation & Patch Release:** Critical issues within 7 calendar days; high/medium within 14 calendar days.

---

## 3. Security Architecture & Controls

The platform implements defense-in-depth across 13 core operational domains:

1. **Authentication & Password Protection:**
   - PBKDF2-HMAC-SHA256 password hashing with 100,000 iterations and per-user cryptographic salts.
   - 5-attempt sliding-window account lockout (15-minute freeze).
   - Unified generic authentication errors in production to eliminate account enumeration.
2. **Session Security & Token Protection:**
   - Server-side sessions stored as cryptographic SHA-256 hashes at rest in `sessions` table.
   - Raw session tokens are delivered via `HttpOnly`, `SameSite=Lax`, `Secure=True` cookies.
   - `__Host-` cookie prefix active in production environments.
   - Session tokens are omitted from JSON response bodies in production to prevent JavaScript token theft.
   - Full session rotation upon login and instant revocation on logout / password change.
3. **Cross-Site Request Forgery (CSRF):**
   - Double-Submit Cookie CSRF protection required on all state-changing routes (`POST`, `PUT`, `PATCH`, `DELETE`) with cookie sessions.
4. **Machine Learning Model Integrity:**
   - SHA-256 pre-deserialization validation ensures `car_price_model.pkl` matches its canonical hash before execution.
5. **Infrastructure & Network:**
   - Multi-stage Docker container executing as non-root `appuser:1000`.
   - `no-new-privileges:true` and `cap_drop: [ALL]` applied to all services.
   - Database and Redis instances operate on internal Docker bridge networks with no exposed host ports.
   - Nginx reverse proxy with HSTS, COOP, CORP, and custom Content-Security-Policy.

---

## 4. Secret Rotation Protocol

In the event of suspected credential compromise:

1. **Database Credentials:**
   - Update database user password in PostgreSQL / AWS RDS.
   - Update `DATABASE_URL` in Secret Manager / environment variables.
   - Trigger zero-downtime rolling restart of backend container replicas.
2. **JWT & Session Secrets:**
   - Rotate `JWT_SECRET` in production environment.
   - Execute `DELETE FROM sessions;` in the database to invalidate all existing sessions, forcing re-authentication.
3. **Model Artifacts:**
   - When retraining the model, recompute SHA-256 (`sha256sum car_price_model.pkl > car_price_model.pkl.sha256`) and commit both simultaneously.
