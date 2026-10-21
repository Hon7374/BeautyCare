# ICCIT 2026 Evidence Cross-Check Matrix

**Verification date:** 2026-10-21  

## V2 crosscheck

The synchronized evidence set uses 55 -> 70 unique security tests, with 70/70 passing across separately recorded phases. The authoritative completion paths are under `raw-results/security-test-coverage/`. Semgrep hosted execution remains unverified; local post-expansion Semgrep is 41/70/5/0/4. B2 run 1 is absent and must not be cited as a verified repetition.
**Repository state:** no Git repository metadata was available in the workspace; no commit hash is claimed.

| Claim or metric | Primary evidence | Cross-check | Evidence status |
|---|---|---|---|
| VNPay Return endpoint is implemented as `GET /api/payments/vnpay/return` | `backend/routes/payments.js:1482` | Route inventory and integration test endpoint field | VERIFIED |
| VNPay Return signature uses HMAC-SHA512 over provider parameters | `backend/utils/providers/vnpay.js` | Test fixture signs provider query; raw artifact records test-only secret label, not its value | VERIFIED for local test path |
| VNPay IPN endpoint exists | `backend/routes/payments.js` (`GET/POST /api/payments/vnpay/ipn`) | HMAC, provider/amount checks, named lock and shared finalization are exercised by integration tests | VERIFIED locally; live provider delivery not verified |
| Provider and amount reconciliation protects the Return path | `backend/routes/payments.js:1500-1504`; integration test source | Amount-mismatch case leaves payment `created`, order `pending`, and zero side-effect rows | VERIFIED |
| Normal/sequential/late Return sequence is idempotent | `raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.json` | Final state paid, one paid event, one transaction | VERIFIED |
| Concurrent Return duplicate handling | Same raw JSON | 3 repetitions × 50 callbacks; durations 249/210/266 ms; one event and one transaction per repetition | VERIFIED for local Return path |
| Invalid signature/tampered amount is rejected without finalization | Same raw JSON and integration test source | Payment remains `created`; order remains `pending`; zero paid events/transactions | VERIFIED |
| Valid signature with persisted amount mismatch is rejected | Same raw JSON and integration test source | Same no-side-effect outcome | VERIFIED |
| User-driven VNPay Sandbox browser payment | `raw-results/vnpay-sandbox/vnpay-browser-run-20261021.json` | 427500 VND; local payment/order `paid`; paid callback at 2026-10-21T08:13:42Z; one matching transaction | VERIFIED for one Sandbox Return execution |
| Smoke regression suite | `npm run test:all` output and synchronized reports | 9 suites, 41 tests | PASS |
| Database regression suite | `npm run test:all` output and synchronized reports | 4 suites, 8 tests | PASS |
| Final Semgrep scan | `raw-results/semgrep/current-source-20261021-1639/after.json` and `after.sarif` | Semgrep 1.182.0; 42 targets; 70 rules; 5 findings; 0 scanner errors; 0 skipped rules; 4 fixpoint timeouts; no `.env*` targets | PARTIAL: findings/timeouts require review; no zero-vulnerability claim |
| Historical Semgrep baseline | `raw-results/semgrep/before.json` and `before.sarif` | Preserved as historical evidence; prior scope included `.env*` paths and is not the authoritative final scope | HISTORICAL |
| 100/200/300 VU performance runs | `results/iccIT-replication/aggregate-summary.json` and run artifacts | Historical performance evidence retained with its original manifest/provenance | VERIFIED as historical artifact |
| 400 VU artifact | `results/iccIT-replication/k6-load-400vus-run1.json` | Retained as a separate artifact; interpretation follows its recorded status | LIMITED / HISTORICAL |
| 500 VU evidence | Existing 500 VU result artifact/report references | Retained only where the original artifact exists; no new unsupported result is inferred | LIMITED / HISTORICAL |
| Explicit DB transaction/rollback atomicity | `backend/db.js` same-connection transaction helper and `backend/routes/payments.js` finalization path | Fault injection before/after payment/event writes rolls back and a retry produces one paid event and one transaction | VERIFIED locally; run package `raw-results/payment-atomicity/20261021-1115/` |
| Reproducibility commit hash | Workspace Git inspection | No Git repository metadata/commit hash available | UNAVAILABLE; not fabricated |

## Interpretation rules

Values from smoke, database, focused integration, Semgrep, and performance suites are separate evidence units and must not be summed. The 150 concurrent callback requests are three repetitions of the same Return-flow experiment, not 150 independent payment transactions. A Semgrep warning is a tool finding, not automatically a confirmed vulnerability; each finding requires code review and, where applicable, exploit validation.

## Evidence package

The sanitized package index and checksums are located under:

`docs/03-development/kiem-thu/ICCIT2026/FINAL_EVIDENCE_PACKAGE/`

| Stateful booking B1 same-slot contention | `raw-results/k6-booking/b1-final-run*-db-assertion.json` | Three runs: 3 accepted, 47 rejected, final DB count 3 and no capacity violation per run | VERIFIED locally |
| Stateful booking B2 sustained workload | `raw-results/k6-booking/b2-final-run2-db-assertion.json`, `b2-final-run3-db-assertion.json` | 19,493 and 19,485 bookings; unique slots; max one booking/slot; no capacity violation | VERIFIED locally |
| VNPay IPN callback load | `raw-results/vnpay-ipn/k6-vnpay-ipn-p1-p1-run2.json`, `p2-p2-run6.json` | P1: 86,584 callbacks, 100 confirmed, 86,484 duplicates; P2: 100 confirmed, 0 duplicates | VERIFIED locally |
| Full final regression | `raw-results/security-test-coverage/test-all-20261021.console.log` | Smoke 9 suites/41 tests; DB 4 suites/8 tests; all passed | VERIFIED locally |
| Semgrep CI workflow | `.github/workflows/semgrep.yml` | JSON/SARIF commands and exclusions are present; no GitHub-hosted execution in this environment | CONFIGURED; CI NOT VERIFIED |
| Latest unique Jest discovery | `backend/tests/*.test.js` and run JSON | 16 test files, 55 declared cases; 53 retained baseline plus 2 meaningful IPN/atomicity cases | VERIFIED locally; category table in report 19 |
| Run-specific evidence writer | Integration test sources with `ICCIT_ARTIFACT_DIR` and out-of-band `VNPAY_TEST_SECRET` | New runs write into explicit directories and do not overwrite historical raw paths; no secret value is stored | VERIFIED by `raw-results/security-test-coverage/full-regression-20261021-1830/` and `raw-results/payment-atomicity/20261021-1115/` |
| Final provenance audit | Historical ZIP comparison, missing-artifact and secret audit | Old ZIPs are duplicate historical copies; no separately bundled raw-results archive or B2 run1 is claimed; final sources contain no literal VNPay secret | `23_FINAL_EVIDENCE_PROVENANCE_AUDIT.md` | VERIFIED |
| Final evidence package | Independent final folder and reopened ZIP | Reports, raw results, test sources, manifests, index, consistency report and checksums | `FINAL_VERIFIED_EVIDENCE/` and `BEAUTYCARE_ICCIT2026_FINAL_VERIFIED_EVIDENCE.zip` | VERIFIED after build |
