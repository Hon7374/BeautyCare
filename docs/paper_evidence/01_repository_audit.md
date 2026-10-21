# Repository audit

**Audit date:** 2026-10-17 (Asia/Saigon). This is a new source audit; runtime results cited below are historical artifacts and are not relabelled as new runs.

## Scope and evidence

The workspace contains a static HTML/CSS/JS frontend, a Node.js/Express backend, a MySQL schema, Jest/Supertest tests, k6 scripts, OWASP ZAP reports, VNPay sandbox summaries, and retained logs. The current directory does not expose usable `.git` metadata, so repository history/diff provenance could not be independently verified.

Key source locations:

| Area | Evidence |
|---|---|
| App composition, CORS, CSRF, limiter | `backend/app.js:96-165`, `backend/app.js:177-183` |
| CSRF middleware | `backend/middleware/csrf.js:1-19` |
| Cookie flags/token generation | `backend/utils/security.js:12-18`, `49-103`; `backend/routes/auth.js:127-130` |
| Refresh rotation/logout | `backend/routes/auth.js:448-555` |
| Pricing rules | `backend/utils/pricing.js:14-138` |
| Payment/checkout routes | `backend/routes/payment.js:10-64`; `backend/routes/payments.js:732-775`, `867-965` |
| Schema and constraints | `database/beautycare.mysql.sql:80-118`, `183-254` |
| Security tests | `backend/tests/security.no-db.test.js:137-173`; `backend/tests/security.auth-flow.test.js:31-146` |
| Load script | `performance/k6-load.js:1-47` |
| Historical experiment report | `docs/EXPERIMENT_RESULTS.md:1-117` |

## Architecture findings

- Authentication uses JWT access/refresh tokens in cookies, with refresh-token hashes stored in `refresh_tokens`, rotation, revocation, and access-token JTI revocation paths.
- CSRF is applied to `/api` before route handlers. It skips safe methods and only enforces when an access or refresh cookie exists.
- CORS uses credentials and exact configured origins in production; localhost is allowed only in non-production local mode.
- Pricing is server-side. Client-supplied `serviceId` and optional `voucherCode` are looked up again; stored order/transaction amounts come from `calculateServiceTotal`.
- The schema has voucher uniqueness, membership plans, tier policy, a maximum total discount setting, orders, bookings, and transactions. No voucher usage counter, per-user usage table, expiry window start, minimum order value, or atomic voucher-consumption constraint was found in the audited schema/code.

## Provenance limits

`.env` was inspected only for key names; secrets and values were not copied into evidence. No production endpoint, public domain, destructive test, or load test was executed during this audit.

