# ICCIT 2026 — Final Verification Report

Date: 2026-10-21 (Asia/Saigon)

## V2 completion status

The final local security inventory is 70/70 unique tests passed (55 preserved baseline plus 15 meaningful additions). Smoke, DB, booking, lint, syntax, and full-regression evidence is retained under `raw-results/security-test-coverage/`. Semgrep remains PARTIAL: current-source 42 targets and post-expansion 41 targets, both with 5 findings, 0 errors, and 4 timeouts. GitHub hosted CI is NOT VERIFIED. B2 run 1 is HISTORICAL / INSUFFICIENT RAW EVIDENCE.

## Final status

| Work item | Status | Evidence |
|---|---|---|
| HMAC CSRF bound to authenticated session | PASS — implemented and unit/regression verified | 29 focused tests; 41 smoke tests |
| Hard-coded JWT fallback removed | PASS — implemented and lint/smoke verified | `backend/middleware/auth.js`, `server.js` |
| Booking race protection | PASS — implemented and DB verified | 50 concurrent requests: 3 accepted, 47 rejected, final count 3 |
| Payment callback idempotency | PASS LOCALLY / LIMITED PROVIDER CLAIM | Real MySQL callback integration: 3 × 50 concurrent duplicates; one event and one transaction per repetition |
| Pricing integrity | PASS — utility behavior verified | 4 pricing tests |
| Isolated full regression | PASS | Final `npm run test:all`: smoke 11/51 and DB suites 9/9; 70 unique inventory |
| SAST | PARTIAL — scope verified, remediated, timeout/manual review remains | Semgrep 1.182.0; current-source 42 JS targets, 5 findings, 0 scanner errors; historical corrected scope retains timeout evidence |
| Dependency audit | PARTIAL | Safe audit fix applied; 36 advisories remain |
| 100/200/300 VU public-read replication | VERIFIED HISTORICAL/RETAINED | 3 repetitions each on 2026-10-17 |
| 400 VU public-read run | VERIFIED SEPARATELY | JSON artifact, zero HTTP failures |
| 500 VU capacity claim | NOT SUPPORTED | Partial failure-affected artifact only |

## SAST verification details

Semgrep was installed in an isolated temporary Python virtual environment and ran successfully. The preserved baseline discovery list contained 40 entries and three `.env*` paths; this ambiguity is retained rather than hidden. The corrected scan selected 37 JavaScript targets with `p/owasp-top-ten` and 70 rules after explicit exclusion verification. It produced 5 findings, 0 fatal errors, and 3 fixpoint timeouts even with `--timeout 0`, so complete rule coverage is not claimed. The workspace has no Git repository; `git rev-parse HEAD` returned `fatal: not a git repository`, so no commit hash is available.

The five pre-remediation warnings all identified the same reflected HTML construction pattern in `backend/routes/payments.js`. The endpoint now escapes displayed values and has four XSS regression cases proving that script, event-handler, encoded and unsafe-URL payloads are not returned as executable markup. The after-scan still reports five locations because the original Semgrep OSS taint configuration does not recognize the local `escapeHtml` sanitizer. This is retained as a transparent residual tool finding/manual-review item, not converted into a false “0 vulnerabilities” result.

Raw evidence and exact commands are in [07_SAST_SECURITY_SCAN.md](07_SAST_SECURITY_SCAN.md), [11_SEMGREP_FINDINGS_VERIFICATION.md](11_SEMGREP_FINDINGS_VERIFICATION.md), and [12_SEMGREP_SCOPE_VERIFICATION.md](12_SEMGREP_SCOPE_VERIFICATION.md). The VNPay evidence is in [13_VNPAY_DUPLICATE_CALLBACK_INTEGRATION.md](13_VNPAY_DUPLICATE_CALLBACK_INTEGRATION.md).

## Remaining limitations

Docker/MySQL is running and the isolated DB tests have been executed. Remaining limitations are the five residual Semgrep tool findings, three corrected-scope fixpoint timeouts, and the lack of a live VNPay provider duplicate-callback replay. No production DB, real payment, or production callback was used.

## Acceptance statement

The implementation, no-DB regression evidence, isolated DB lifecycle evidence, booking concurrency evidence, VNPay application-callback integration evidence, and executed SAST artifacts are ready for review with the stated limitations. The ICCIT evidence package must preserve SAST as PARTIAL and must not claim a clean scan until the five residual findings and timeout coverage are resolved through verified rule modeling or an independent manual/security review.

## 2026-10-21 rerun addendum

The earlier local rerun completed with Docker MySQL on `127.0.0.1:3310`, isolated database `beautycare_test`, and the backend health endpoint available on `http://localhost:3000`. ESLint passed; the smoke suite passed with 9 suites and 41 tests; that historical full isolated suite passed with 2 DB suites and 6 DB tests. The final source-state run is recorded below with 4 DB suites and 8 DB tests.

### Latest final regression correction — 2026-10-21

The subsequently rerun `npm run test:all` passed with smoke 9 suites/41 tests and DB 4 suites/8 tests. A run-specific rerun at `raw-results/security-test-coverage/rerun-20261021-1112/` independently records 41/41 smoke tests and 8/8 DB tests with zero failures/skips. Its integration artifacts are isolated from historical raw paths. The latest VNPay raw artifact records concurrent durations of 249 ms, 210 ms, and 266 ms. The valid-signature amount-mismatch case still leaves payment `created`, order `pending`, and zero paid events/transactions. These latest values supersede only the earlier timing values; the earlier raw evidence remains historical.

### VNPay Sandbox browser cross-check — 2026-10-21

A user-driven payment through `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` was cross-checked in the local `beautycare` database. The sanitized artifact records a `427500 VND` checkout created at `08:12:31Z`, paid at `08:13:42Z`, with the order marked `paid`, payment events `pending` then `paid`, and one matching transaction. Card data, OTP, and provider credentials were excluded. This confirms one Sandbox Return-flow execution only; it does not establish live-provider IPN delivery.

The scope-corrected Semgrep rerun used Semgrep 1.182.0, `p/owasp-top-ten`, 37 selected JavaScript targets, 70 rules, 5 findings, 0 errors, and 3 fixpoint timeouts. No `.env*` path was selected. Raw files: `raw-results/semgrep/rerun-final-20261021-100247/scope-timeout0.json` and `.sarif`. The SAST status remains PARTIAL; no finding was relabeled as a false positive and no clean-scan claim is made.

The 37-target/5-timeout post-remediation rerun at `raw-results/semgrep/final-rerun-20261021-144721/` is historical. The authoritative current-source artifact is `raw-results/semgrep/current-source-20261021-1639/`: 42 targets, 70 rules, 5 findings, 0 errors, 0 skipped rules and 4 fixpoint timeouts. The VNPay source fix and regression test also passed; a valid-signature amount mismatch produces no payment side effects. VNPay IPN is implemented and verified locally with signed callbacks, duplicate delivery, race, rollback and retry tests; this does not establish live-provider delivery behavior.

## Final evidence matrix

The current-source Semgrep rerun performed after the IPN and same-connection transaction changes is the authoritative SAST artifact for this final package: Semgrep 1.182.0, `p/owasp-top-ten`, 42 JavaScript targets, 70 rules, 5 findings, 0 scanner errors, 0 skipped rules and 4 fixpoint timeouts. JSON and SARIF are in `raw-results/semgrep/current-source-20261021-1639/`. Prior timeout-bearing Semgrep artifacts remain historical and are not overwritten. SAST remains PARTIAL because the five findings and four timeouts require code review/manual sanitizer modeling; no clean-scan or zero-vulnerability claim is made.

| Work item | Before | Implemented | Tested | Result | Evidence |
|---|---|---|---|---|---|
| Stateful booking B1/B2 | Only historical public-read load evidence | Authenticated k6 workloads plus DB assertions | B1: 3 runs × 50 VUs; B2: 3 full runs up to 50 VUs | PASS locally; B1 3 accepted/47 rejected per run; B2 runs 2/3 no capacity violation | `16_K6_BOOKING_PERFORMANCE_EVALUATION.md`, `raw-results/k6-booking/` |
| VNPay IPN | No VNPay IPN evidence | HMAC verification, provider/amount reconciliation, named lock and idempotent finalization | Integration scenarios plus k6 P1/P2 | PASS locally / live provider unverified | `17_VNPAY_IPN_IMPLEMENTATION_AND_PERFORMANCE.md`, `raw-results/vnpay-ipn/` |
| k6 payment callback | Return-only callback evidence | IPN and Return share guarded finalization | P1 86,584 callbacks; P2 100 callbacks | PASS locally; duplicate side effects bounded | `17_VNPAY_IPN_IMPLEMENTATION_AND_PERFORMANCE.md` |
| Payment atomicity | Rollback was previously unverified | Same-connection transaction over finalization writes | Fault injection before/after writes and retry | PASS locally; no partial paid state observed | `18_PAYMENT_ATOMICITY_AND_RECOVERY.md`, `raw-results/payment-atomicity/20261021-1115/` |
| Failure recovery | No retry evidence | Retry after transient finalization failure | Injected failure followed by valid retry | PASS locally; one paid event/transaction | `18_PAYMENT_ATOMICITY_AND_RECOVERY.md` |
| Security test coverage | Earlier suites only | IPN, atomicity, auth-flow, validation, authorization and pricing regression coverage | 11 smoke suites/51 tests; 4 DB suites/9 tests; 70 unique maintained cases | PASS locally | `24_SECURITY_COVERAGE_COMPLETION.md`, `raw-results/security-test-coverage/completion-20261021-2100/` |
| Semgrep CI/CD | Local scan only | `.github/workflows/semgrep.yml` with JSON/SARIF and exclusions | Workflow syntax/content reviewed; GitHub run unavailable | CONFIGURED / CI NOT VERIFIED | `20_SEMGREP_CI_INTEGRATION.md` |
