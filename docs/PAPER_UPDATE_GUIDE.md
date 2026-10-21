# Paper Update Guide

This guide records claims that are safe to replace using the runtime evidence currently retained in the repository. No new heavy test run was performed for this cleanup.

## Evidence baseline

| Item | Runtime-confirmed replacement |
|---|---|
| Dependency state | `backend/npm install --ignore-scripts --no-audit --no-fund` completed with `up to date` |
| Automated tests | `npm test`: 8 suites, 36 tests passed; `npm run test:all`: 9 suites, 41 tests passed; 0 failures and 0 skips |
| Database integration | `npm run db:test`: 1 DB suite, 5/5 tests passed on isolated `beautycare_test` using MySQL 8.4.11 at port 3310 |
| VNPay local signing | HashSecret absent from generated URL; valid signature accepted; tampered amount rejected |
| Rate limiting | Default threshold enforced with HTTP 429; `PERF_TEST` is restricted to non-production localhost mode |
| ZAP | Docker baseline report: High 0, Medium 4 alert types, Low 2 alert types, Informational 3 alert types; FAIL-NEW 0; WARN-NEW 6 |
| Dependency audit | 1 high advisory in direct `nodemailer`; 1 moderate advisory in direct `uuid`; 1 moderate advisory in transitive `qs` |
| VNPay Sandbox E2E | 11 current batch payment rows verified: 10 `paid`, 1 `failed`; latest paid row contained `amount=495000 VND`, `booking_id=21`, `order_id=23`, and `paid_at` |

## K6 results that may be cited

All values below come from the retained JSON summaries in `results/`. Latencies are milliseconds.

| Profile | Duration | Requests | RPS | Avg | p90 | p95 | p99 | Error rate | Status distribution |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Smoke / 1 VU | 30s | 60 | 1.982 | 3.998 | 6.606 | 6.705 | 8.182 | 0% | 200: 60 |
| 20 VUs | 30s | 20,735 | 690.686 | 28.793 | 36.754 | 39.911 | 46.646 | 0% | 200: 20,735 |
| 50 VUs | 30s | 22,534 | 749.951 | 66.460 | 79.324 | 86.205 | 109.906 | 0% | 200: 22,534 |
| 100 VUs | 30s | 23,103 | 767.172 | 129.884 | 143.024 | 152.895 | 188.977 | 0% | 200: 23,103 |
| 200 VUs | 30s | 20,489 | 678.199 | 293.104 | 354.584 | 384.312 | 465.214 | 0% | 200: 20,489 |
| 500 VUs | 14.8s partial; stopped | 12,425 | 838.560 | 576.463 | 723.404 | 736.878 | 937.874 | 14.7606% | 200: 10,591; other/connection failures: 1,834 |
| 100 VUs | 5m | 294,163 | 980.340 | 101.835 | 114.566 | 121.185 | 141.725 | 0% | 200: 294,163 |
| 200 VUs | 5m | 287,191 | 956.814 | 208.797 | 227.903 | 236.883 | 251.423 | 0% | 200: 287,191 |
| 300 VUs | 5m | 286,276 | 953.492 | 314.271 | 340.442 | 353.194 | 375.449 | 0% | 200: 286,276 |
| 400 VUs | approximately 14s; stopped | 12,486 observed before interruption | not finalized | not finalized | not finalized | not finalized | not finalized | connection-refused failures observed | STOPPED / overload-limit observation |

### Suggested Academic English for performance

> Under the local performance-test configuration, the system completed 30-second runs at 20, 50, 100, and 200 virtual users without HTTP errors in the retained k6 summaries. The 500-VU run was terminated after approximately 14.8 seconds when connection failures occurred; it is therefore reported as an overload/limit observation rather than a completed capacity result.

Additional wording for the optimized run:

> After a localhost-only performance optimization that increased the bounded database-pool capacity and removed per-request access-log I/O, the system completed five-minute profiles at 100, 200, and 300 virtual users with zero HTTP errors. A 400-VU attempt was stopped after approximately 14 seconds because connection refusals recurred; it produced no finalized five-minute summary and is reported only as an overload/limit observation.

Do not describe 500 VUs as a passed capacity target. Do not use the earlier default-rate-limit 100-VU run as performance evidence; that run measured HTTP 429 enforcement, not application capacity.

## Claims requiring replacement

### 1. Historical test counts

Old claim:

> “6 suites / 25 tests”

Replacement:

> “The current repository contains eight smoke/unit suites with 36 passing tests; the full run contains nine suites and 41 passing tests, including the database-backed suite.”

Old claim:

> “13 security checks”

Replacement:

> “The current no-DB security regression suite reports 19 passing tests. The DB-backed auth-flow suite reports 5 additional passing tests. Coverage claims should remain limited to the controls explicitly exercised by those suites.”

The exact strings “6 suites / 25 tests” and “13 security checks” were not found in the current repository text search; if they occur in the manuscript or external paper source, replace them using the wording above.

### 2. Database availability

Old claim:

> “DB tests skipped” / “MySQL unreachable”

Replacement:

> “For the final evidence run, MySQL was available through the Docker test instance at 127.0.0.1:3310. The isolated database `beautycare_test` was initialized and the DB integration suite passed 5/5 tests.”

Do not claim that port 3306 was available: the final environment used port 3310. The skip message in `backend/scripts/run-tests.js` is a conditional fallback, not evidence that the final run was skipped.

### 3. Historical independent-MySQL evidence

Old repository documentation in `docs/REPORT_EVIDENCE.md` records a historical run with `127.0.0.1:3411` and 38 tests. It is superseded for the current paper evidence by the 2026-09-27 run: 9 suites and 41 passing tests, with the isolated DB test at port 3310.

Suggested replacement:

> “On 2026-09-27, the final evidence run used Docker MySQL 8.4.11 with an isolated `beautycare_test` database on port 3310. The full automated run passed 9 suites and 41 tests.”

### 4. Concurrency/load wording

No current repository text occurrence of the phrase “old concurrency test” was found. Any manuscript claim describing a small local concurrency experiment must be replaced with the k6 table above, and the 500-VU observation must remain explicitly partial.

Suggested replacement:

> “Load was evaluated incrementally using k6 at smoke, 20, 50, 100, 200, and partial 500-VU profiles. The 500-VU profile was stopped after connection failures and is not interpreted as a completed capacity result.”

## VNPay wording

### Allowed local-verification claim

> “Local VNPay signing verification passed: the generated payment URL did not contain the HashSecret, a valid signature was accepted, and a modified amount caused verification failure.”

### Sandbox wording now supported by the latest evidence

> “Eleven current VNPay Sandbox payment attempts were verified in the database: ten reached `paid` and one reached `failed`. The successful records stored the provider, amount, booking/order association, provider reference, and payment timestamp. Local signing verification is reported separately from this end-to-end transaction evidence.”

Do not use the local signing test or mock-provider tests alone as evidence of Sandbox E2E.

## Claims not yet permitted

- “500 VUs passed” or “500-VU capacity was demonstrated.”
- “VNPay Sandbox E2E completed” without limiting the claim to the retained 11-attempt evidence set and distinguishing the one failed attempt.
- “VNPay Sandbox E2E completed.”
- “All security controls were verified” without naming the controls exercised by the tests.
- “No ZAP findings.” The report contains 4 Medium, 2 Low, and 3 Informational alert types, plus 6 WARN-NEW categories.
- “No dependency vulnerabilities.” `npm audit` reports 1 High and 2 Moderate advisories.
- “MySQL was available on port 3306.” The verified test port was 3310.

## Evidence artifacts

- `results/k6-smoke-summary.json`
- `results/k6-load-20vus.json`
- `results/k6-load-50vus.json`
- `results/k6-load-100vus.json`
- `results/k6-load-200vus.json`
- `results/k6-load-500vus.json`
- `results/vnpay-sandbox/transaction-summary.json`
- `results/zap-final/zap-final.json`
- `results/zap-final/zap-final.html`
- `docs/EXPERIMENT_RESULTS.md`
