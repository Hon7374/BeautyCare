# Environment

- Node.js: v24.12.0
- npm: v11.12.1
- MySQL: Docker MySQL 8.4.11 test instance on `127.0.0.1:3310`
- OS: Windows PowerShell environment
- Test date: 2026-09-27
- Dependency install: `backend/npm install --ignore-scripts --no-audit --no-fund` completed successfully (`up to date`)
- Build script: not defined in `backend/package.json`

# Automated Tests

- Command: `cd backend; npm run test:all` with the isolated Docker MySQL environment
- Suites: 9
- Passed: 41 tests
- Failed: 0
- Skipped: 0
- Breakdown: 8 no-DB suites / 36 tests plus 1 DB integration/security suite / 5 tests

# Database Integration

- DB connection status: PASS using isolated database `beautycare_test`
- Isolated test database setup: PASS via `npm run db:test` (final audit rerun)
- Integration tests executed: 1 suite / 5 tests
- Results: 5 passed, 0 failed

# VNPay Local Verification

- Credential source: environment variables from `backend/.env`; values were not printed.
- Payment URL secret exposure check: PASS; the HashSecret was not present in the generated URL.
- Local signature verification: PASS.
- Tampered payload verification: PASS; modified `vnp_Amount` was rejected.
- Provider/reference persistence and callback mutation are covered by route architecture, but no dedicated real-DB VNPay callback test exists; therefore those items remain PARTIAL.

# VNPay Sandbox

- Implementation status: implemented in the existing checkout/return architecture, with environment-based credentials and signed return verification
- Actual sandbox execution status: EXECUTED successfully
- Runtime evidence: payment-result page displayed provider `vnpay` and status `paid`; the latest MySQL row was verified with `amount=617500 VND`, `status=paid`, `booking_id=13`, `order_id=14`, and a populated `paid_at`.
- The provider reference was stored server-side and is intentionally not reproduced in this document.
- This Sandbox result is separate from local signing verification and from mock-provider tests.

# VNPay Transaction Batch

- Retained current E2E evidence: 11 transactions
- Successful: 10
- Failed: 1
- Cancelled: 0 in this evidence scope
- Signature rejected: 0
- Duplicate callback/retry: not separately measured
- DB rows verified: 11
- Details: `results/vnpay-sandbox/transaction-summary.json` and `results/vnpay-sandbox/transaction-summary.md`
- Historical database rows are excluded when no checkout evidence was retained.

# Rate-limit security evidence

- Default API limiter: 300 requests per 15 minutes per client IP.
- The original 100-VU run produced HTTP 429 for 99.8313% of requests because all k6 traffic shared one client address and exceeded that 300-request window. This is expected security behavior, not capacity evidence.
- Security regression: 19/19 no-DB tests passed, including default-mode 429 enforcement, local performance-mode isolation, and production-mode protection when `PERF_TEST=true` is supplied.

# Performance benchmark without rate-limit interference

The benchmark server ran separately on `127.0.0.1:3001` with `PERF_TEST=true`. The mode is enabled only when the app is non-production and `PUBLIC_APP_URL` resolves to localhost; authentication, RBAC, CSRF, and login rate limiting remain active. The normal app stayed on port 3000.

| Profile | Requests | RPS | Avg ms | p90 ms | p95 ms | p99 ms | Error rate | Status distribution | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| smoke / 1 VU / 30s | 60 | 1.982 | 3.998 | 6.606 | 6.705 | 8.182 | 0% | 200: 60 | PASS |
| 20 VUs / 30s | 20,735 | 690.686 | 28.793 | 36.754 | 39.911 | 46.646 | 0% | 200: 20,735 | PASS |
| 50 VUs / 30s | 22,534 | 749.951 | 66.460 | 79.324 | 86.205 | 109.906 | 0% | 200: 22,534 | PASS |
| 100 VUs / 30s | 23,103 | 767.172 | 129.884 | 143.024 | 152.895 | 188.977 | 0% | 200: 23,103 | PASS |
| 200 VUs / 30s | 20,489 | 678.199 | 293.104 | 354.584 | 384.312 | 465.214 | 0% | 200: 20,489 | PASS |
| 500 VUs / partial, stopped at 14.8s | 12,425 | 838.560 | 576.463 | 723.404 | 736.878 | 937.874 | 14.7606% | 200: 10,591; connection/other: 1,834 | STOPPED |
| 100 VUs / 5m | 294,163 | 980.340 | 101.835 | 114.566 | 121.185 | 141.725 | 0% | 200: 294,163 | PASS |
| 200 VUs / 5m | 287,191 | 956.814 | 208.797 | 227.903 | 236.883 | 251.423 | 0% | 200: 287,191 | PASS |
| 300 VUs / 5m | 286,276 | 953.492 | 314.271 | 340.442 | 353.194 | 375.449 | 0% | 200: 286,276 | PASS |

The earlier 500-VU run was stopped after the benchmark server began returning `connection refused`; it is a partial overload observation, not a completed capacity result. The new 100/200/300 VU profiles completed five minutes without HTTP errors. Artifacts include `results/k6-load-100vus.json`, `results/k6-load-200vus.json`, and `results/k6-load-300vus.json`.

The next incremental attempt at 400 VUs was stopped after approximately 14 seconds because k6 repeatedly received `connection refused`. The run did not produce a finalized JSON summary; the console showed 12,486 completed one-request iterations before interruption. It is recorded only as a limit observation, not as a 5-minute result. The 500-VU profile was not retried after this failure.

# Performance root-cause and optimization evidence

The earlier 500-VU failure was not caused by HTTP 429. The performance-only mode raised the general API limiter on a localhost test server, while authentication, RBAC, CSRF, and login limiting remained enabled. Runtime evidence showed rising service latency followed by `connection refused`, with no uncaught-exception or application-level connection-error record in the retained log. The supported interpretation is local saturation/backpressure at the HTTP/DB path, amplified by per-request access-log I/O. The original DB pool used 10 connections with an unbounded wait queue.

For localhost performance mode only, the implementation now uses a bounded DB-pool configuration (default 25 connections, capped at 50, queue limit 1000) and suppresses per-request access-log writes while retaining error/security logging. Development/production defaults are unchanged. These changes improved the completed 100/200/300-VU five-minute runs, but the 400-VU attempt still encountered connection refusal; no capacity claim is made above the observed 300-VU completed profile.

Resource observation after the 300-VU run: benchmark process health endpoint returned HTTP 200; process working set was approximately 121.2 MB. No process crash or restart was observed during the completed 5-minute profiles.

# OWASP ZAP

- Scan type: Docker OWASP ZAP baseline against local app on port 3000
- High: 0
- Medium: 4 alert types
- Low: 2 alert types
- Informational: 3 alert types
- FAIL-NEW: 0
- WARN-NEW: 6
- PASS checks: 61
- Artifacts: `results/zap-final/zap-final.html`, `results/zap-final/zap-final.json`
- WARN-NEW categories: suspicious comments, storable/cacheable content, CSP directive issues, Permissions Policy, missing SRI, and Cross-Origin-Embedder-Policy

# Security Regression

- Executed no-DB security regression suite: 19/19 passed
- Covered by the executed suite: cookie flags, CSRF double-submit, JWT acceptance/rejection, revoked token rejection, RBAC, HTTPS redirect/trusted proxy and CORS fail-closed behavior
- DB-backed refresh rotation and 2FA flow: 5/5 passed against the isolated Docker MySQL database
- `npm run audit`: 3 advisories remain after the compatible automatic update (1 high Nodemailer, 2 moderate transitive/uuid-related advisories); no force-breaking upgrade was applied
- Final `npm audit --audit-level=high`: 3 total advisories (1 high, 2 moderate). The high advisory is caused by direct `nodemailer`; the moderate advisories are caused by direct `uuid` and transitive `qs`. Fixes for the direct packages require major upgrades, so no automatic breaking upgrade was applied.

# Remaining Limitations

- The executed DB evidence uses a disposable Docker test instance; production/development MySQL still requires its own configured credentials.
- A further independent IPN retry/replay test would strengthen the evidence, but the latest Sandbox checkout, return/payment-result, and DB payment-state update are now confirmed.
- The 500-VU run was intentionally stopped after connection failures at approximately 14.8 seconds; do not present it as a completed capacity result.
- The 400-VU follow-up was also stopped after connection failures at approximately 14 seconds and has no finalized 5-minute summary; do not present it as a pass.
- `PERF_TEST=true` must remain restricted to localhost/test environments and must never be enabled in production.
- Existing paper numbers about VNPay completion or unexecuted load profiles must remain marked unexecuted until those experiments produce artifacts.
