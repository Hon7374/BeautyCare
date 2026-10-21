# ICCIT 2026 Evidence Cross-Check Matrix

## Current authoritative cross-check — 2026-10-22

The current local and hosted evidence set uses Semgrep 1.182.0, `p/owasp-top-ten`, 42/42 runtime-generated JavaScript targets, and 70 executed rules. The final local JSON/SARIF result under `raw-results/semgrep-remediation/20261022/final-ci-verification/` and the downloaded hosted artifact under `raw-results/semgrep-remediation/20261022/hosted-run-39694608906/` contain 0 findings, 0 scanner errors, 0 skipped rules, and 0 fixpoint timeouts; both fail-closed gates are `PASS`, exit 0. Smoke is 68/68, focused sanitizer/payment is 7/7, database security/payment is 9/9, and gate regression is 14/14. The workflow configuration preserves the same scope and ruleset with `--jobs 1`. GitHub-hosted post-fix PR run `39694608906` is verified PASS on commit `1c7a6a67645e15142b0fa2933316f6f68c5adc5a`.

**Verification date:** 2026-10-21  

## V2 crosscheck

Historical baseline inventory: the synchronized evidence set used 55 -> 70 unique security tests. Historical Semgrep values below are retained for provenance; the current canonical values are in the cross-check above and in report 38. B2 run 1 is absent and must not be cited as a verified repetition.
**Repository state:** verification branch `fix/semgrep-ci-final-verification`, source commit `1c7a6a67645e15142b0fa2933316f6f68c5adc5a`; no main-branch merge is claimed.

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
| Historical pre-remediation Semgrep scan | `raw-results/semgrep/current-source-20261021-1639/after.json` and `after.sarif` | Semgrep 1.182.0; 42 targets; 70 rules; 5 findings; 0 scanner errors; 0 skipped rules; 4 fixpoint timeouts | HISTORICAL |
| Current worker-serialized Semgrep scan | `raw-results/semgrep-remediation/20261022/final-ci-verification/semgrep.json` and `.sarif`, plus hosted artifact | Semgrep 1.182.0; 42/42 targets; 70 rules; 0 findings; 0 scanner errors; 0 skipped rules; 0 fixpoint timeouts; local and hosted gate PASS | VERIFIED locally and hosted |
| Historical Semgrep baseline | `raw-results/semgrep/before.json` and `before.sarif` | Preserved as historical evidence; prior scope included `.env*` paths and is not the authoritative final scope | HISTORICAL |
| 100/200/300 VU performance runs | `results/iccIT-replication/aggregate-summary.json` and run artifacts | Historical performance evidence retained with its original manifest/provenance | VERIFIED as historical artifact |
| 400 VU artifact | `results/iccIT-replication/k6-load-400vus-run1.json` | Retained as a separate artifact; interpretation follows its recorded status | LIMITED / HISTORICAL |
| 500 VU evidence | Existing 500 VU result artifact/report references | Retained only where the original artifact exists; no new unsupported result is inferred | LIMITED / HISTORICAL |
| Explicit DB transaction/rollback atomicity | `backend/db.js` same-connection transaction helper and `backend/routes/payments.js` finalization path | Fault injection before/after payment/event writes rolls back and a retry produces one paid event and one transaction | VERIFIED locally; run package `raw-results/payment-atomicity/20261021-1115/` |
| Reproducibility commit hash | Git branch and hosted run metadata | `1c7a6a67645e15142b0fa2933316f6f68c5adc5a`; PR run `39694608906` | VERIFIED |

## Interpretation rules

## Current evidence details

The current local raw pair, expected scope, invocation metadata and gate summary under `raw-results/semgrep-remediation/20261022/final-ci-verification/`, together with the hosted artifact under `hosted-run-39694608906/`, agree semantically on 42/42 targets, 0 findings, 0 scanner errors, 0 skipped rules and 0 fixpoint timeouts. Gate tests are 14/14 and smoke is 68/68. Worker-count diagnostics and the MRE remain in `analysis/worker-count/`, `semgrep-timeout-mre/`, and report 38.

Values from smoke, database, focused integration, Semgrep, and performance suites are separate evidence units and must not be summed. The 150 concurrent callback requests are three repetitions of the same Return-flow experiment, not 150 independent payment transactions. A Semgrep warning is a tool finding, not automatically a confirmed vulnerability; each finding requires code review and, where applicable, exploit validation.

## Evidence package

The sanitized package index and checksums are located under:

`docs/03-development/kiem-thu/ICCIT2026/FINAL_EVIDENCE_PACKAGE/`

| Stateful booking B1 same-slot contention | `raw-results/k6-booking/b1-final-run*-db-assertion.json` | Three runs: 3 accepted, 47 rejected, final DB count 3 and no capacity violation per run | VERIFIED locally |
| Stateful booking B2 sustained workload | `raw-results/k6-booking/b2-final-run2-db-assertion.json`, `b2-final-run3-db-assertion.json` | 19,493 and 19,485 bookings; unique slots; max one booking/slot; no capacity violation | VERIFIED locally |
| VNPay IPN callback load | `raw-results/vnpay-ipn/k6-vnpay-ipn-p1-p1-run2.json`, `p2-p2-run6.json` | P1: 86,584 callbacks, 100 confirmed, 86,484 duplicates; P2: 100 confirmed, 0 duplicates | VERIFIED locally |
| Full final regression | `raw-results/security-test-coverage/test-all-20261021.console.log` | Smoke 9 suites/41 tests; DB 4 suites/8 tests; all passed | VERIFIED locally |
| Semgrep CI workflow | `.github/workflows/semgrep.yml` | JSON/SARIF commands, exclusions, serial workers, fail-closed gate, and artifact upload were exercised by PR run `39694608906` | CONFIGURED; CI VERIFIED PASS |
| Latest unique Jest discovery | `backend/tests/*.test.js` and run JSON | 16 test files, 55 declared cases; 53 retained baseline plus 2 meaningful IPN/atomicity cases | VERIFIED locally; category table in report 19 |
| Run-specific evidence writer | Integration test sources with `ICCIT_ARTIFACT_DIR` and out-of-band `VNPAY_TEST_SECRET` | New runs write into explicit directories and do not overwrite historical raw paths; no secret value is stored | VERIFIED by `raw-results/security-test-coverage/full-regression-20261021-1830/` and `raw-results/payment-atomicity/20261021-1115/` |
| Final provenance audit | Historical ZIP comparison, missing-artifact and secret audit | Old ZIPs are duplicate historical copies; no separately bundled raw-results archive or B2 run1 is claimed; final sources contain no literal VNPay secret | `23_FINAL_EVIDENCE_PROVENANCE_AUDIT.md` | VERIFIED |

## Historical pre-worker-serialization cross-check

The earlier remediation row remains historical evidence: the same 42 targets had 0 findings, 0 errors and 4 `time.fixpoint_timeouts`, with a fail-closed `INCOMPLETE_ANALYSIS` gate. Supporting source, test, and timeout evidence is retained in reports 29–37.
| Final evidence package | Independent final folder and reopened ZIP | Reports, raw results, test sources, manifests, index, consistency report and checksums | `FINAL_VERIFIED_EVIDENCE/` and `BEAUTYCARE_ICCIT2026_FINAL_VERIFIED_EVIDENCE.zip` | VERIFIED after build |
