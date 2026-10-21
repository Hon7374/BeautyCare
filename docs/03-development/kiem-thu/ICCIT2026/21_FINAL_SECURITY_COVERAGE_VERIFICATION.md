# ICCIT 2026 — Final Security Coverage Verification

Date: 2026-10-21 (Asia/Saigon)

## V2 final state

Final unique inventory: 70 tests, composed of the preserved 55-test baseline and 15 meaningful additions; all 70 passed. Smoke 51/51, DB 9/9, booking 3/3, focused 36/36, lint and syntax pass. This is local verification only. Hosted CI is not verified, SAST is partial, and B2 run 1 is missing.

## Result

The current repository contains 16 maintained Jest test files with 55 declared, unique test cases. The reconstructed pre-IPN/atomicity baseline is 53 cases; two meaningful cases were added: one VNPay IPN contract/recovery case and one payment-atomicity/recovery case. The final measured aggregate is 55 passed, 0 failed and 0 skipped. The aggregate combines separately executed Jest phases and is not claimed as one invocation.

| Evidence group | Suites | Tests | Passed | Failed | Skipped | Status |
|---|---:|---:|---:|---:|---:|---|
| Smoke/unit/no-DB | 9 | 41 | 41 | 0 | 0 | PASS |
| Focused no-DB | 2 | 5 | 5 | 0 | 0 | PASS |
| DB integration/security | 4 | 8 | 8 | 0 | 0 | PASS |
| Booking concurrency | 1 | 1 | 1 | 0 | 0 | PASS |
| Unique maintained total | 16 files | 55 | 55 | 0 | 0 | PASS locally |

The final `npm run test:all` run independently passed the smoke phase at 9 suites/41 tests and the DB phase at 4 suites/8 tests. ESLint, syntax checks for the changed integration tests, and the focused suites also passed. MySQL was isolated to `beautycare_test` on `127.0.0.1:3310`.

## Per-file discovery and execution table

`baseline` is the reconstructed pre-improvement count; `added` identifies only the two non-redundant cases. Category labels are primary reporting labels and are not summed because some tests exercise multiple controls.

| Test file | Category | Baseline | Added | Final | Phase | Passed/Failed/Skipped | Raw evidence |
|---|---|---:|---:|---:|---|---|---|
| `admin.users.no-db.test.js` | Authorization | 3 | 0 | 3 | smoke | 3/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `booking-concurrency.integration.test.js` | Booking/concurrency | 1 | 0 | 1 | separate | 1/0/0 | `rerun-20261021-1830/booking-jest.json` |
| `booking-mailer.test.js` | Operational | 3 | 0 | 3 | smoke | 3/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `mailer.test.js` | Operational | 2 | 0 | 2 | smoke | 2/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `payment-atomicity.integration.test.js` | Payment/idempotency/recovery | 0 | 1 | 1 | DB | 1/0/0 | `full-regression-20261021-1830/integration/payment-atomicity.json` |
| `payment-idempotency.no-db.test.js` | Payment/idempotency/recovery | 1 | 0 | 1 | focused | 1/0/0 | `rerun-20261021-1830/focused-jest.json` |
| `payment-mock-xss.no-db.test.js` | XSS/SAST regression | 4 | 0 | 4 | smoke | 4/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `payments.subscription-change.no-db.test.js` | Payment/idempotency/recovery | 3 | 0 | 3 | smoke | 3/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `pricing.integrity.no-db.test.js` | Pricing integrity | 4 | 0 | 4 | focused | 4/0/0 | `rerun-20261021-1830/focused-jest.json` |
| `security.auth-flow.test.js` | Authentication / session | 5 | 0 | 5 | DB | 5/0/0 | `full-regression-20261021-1830/test-all-console.log` |
| `security.no-db.test.js` | Auth / authorization / CSRF | 20 | 0 | 20 | smoke | 20/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `service-image-upload.test.js` | Operational | 2 | 0 | 2 | smoke | 2/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `smoke.test.js` | Operational | 3 | 0 | 3 | smoke | 3/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `smtp.transport.integration.test.js` | Operational | 1 | 0 | 1 | smoke | 1/0/0 | `rerun-20261021-1830/smoke-jest.json` |
| `vnpay-duplicate-callback.integration.test.js` | Payment/idempotency/recovery | 1 | 0 | 1 | DB | 1/0/0 | `full-regression-20261021-1830/integration/vnpay-duplicate-callback.json` |
| `vnpay-ipn.integration.test.js` | Payment/idempotency/recovery | 0 | 1 | 1 | DB | 1/0/0 | `full-regression-20261021-1830/integration/vnpay-ipn.json` |

The machine-readable discovery record is `raw-results/security-test-coverage/test-discovery-baseline-20261021.json`. It records 16 files, 55 declared cases, baseline 53, two added cases, and final 55.

## Security gap assessment

The executed coverage exercises authentication lifecycle, authorization boundaries, session-bound CSRF, rate limiting, pricing recomputation, booking capacity locking, provider signature and amount validation, duplicate Return/IPN callbacks, transaction rollback, retry recovery and XSS regression payloads. The two added tests are behaviorally distinct and cover previously missing IPN and atomicity/recovery contracts.

Remaining gaps are live VNPay retry/network delivery, browser-level cross-origin deployment, distributed database failover, external email delivery guarantees, and complete SAST rule coverage. The local tests do not establish production capacity, provider reliability or zero vulnerabilities.

## Secret handling correction

The two VNPay integration sources previously contained a hard-coded test secret. They now require `VNPAY_TEST_SECRET` from the environment and assign it to the application configuration only inside the test process. Reruns supplied a disposable test value out-of-band; the value is not in source, logs, JSON evidence, reports or the final package. Reproduction requires setting `VNPAY_TEST_SECRET` in the shell without echoing it or committing it.

## Reproducibility and evidence boundary

Run-specific writers use `ICCIT_ARTIFACT_DIR`, so current evidence is placed under unique run directories and does not overwrite historical fixed-path JSON. The workspace has no Git metadata, so no commit hash is available. Historical fixed-path files remain labeled as historical provenance in the audit report.

## Academic readiness statement

The security-test evidence is technically reproducible for the tested local MySQL boundary and is suitable for a bounded ICCIT 2026 result statement. It supports claims about implemented controls and observed local invariants only; it does not support claims of complete security coverage, live-provider reliability or production guarantees.
