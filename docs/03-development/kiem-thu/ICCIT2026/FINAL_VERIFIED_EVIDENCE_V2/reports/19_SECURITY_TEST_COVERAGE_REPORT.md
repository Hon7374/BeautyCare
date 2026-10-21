# ICCIT 2026 — Security Test Coverage Report

## Final completion addendum

The coverage baseline was 55 unique tests. Fifteen meaningful tests were added, producing 70 unique tests with 70/70 passing and no skips. Final phase evidence: smoke 51/51, focused 36/36, DB 9/9, booking 3/3, lint pass, and 18 test-file syntax checks pass. See report 24 and the V2 raw paths under `raw-results/security-test-coverage/`.

## Counting policy

Counts are taken from executed Jest output and are not added across overlapping smoke, focused, and database invocations. A test is counted once in the suite where it is maintained. Performance requests, Semgrep findings, and browser Sandbox checks are separate evidence units and are not converted into Jest test counts.

## Executed coverage groups

The repository contains unit/no-database tests for authentication, authorization, CSRF, pricing, payment idempotency, admin access, mailer behavior, and security middleware. Database-backed tests cover authentication lifecycle, booking concurrency, VNPay Return idempotency, VNPay IPN contract/idempotency, and payment atomicity/recovery. The new IPN and atomicity tests add meaningful behavior and are not count-padding tests.

The full regression command is:

```powershell
$env:DB_NAME='beautycare_test'; npm run test:all
```

The retained final suite totals are in `raw-results/security-test-coverage/test-all-20261021.console.log`. The latest run-specific full regression at `raw-results/security-test-coverage/full-regression-20261021-1830/` independently passed 9 suites/41 tests in the smoke phase and 4 suites/8 tests in the database phase, with no failed or skipped tests. A machine-readable discovery baseline is at `raw-results/security-test-coverage/test-discovery-baseline-20261021.json`. The groups are reported separately because the runner invokes them separately; they are not added to earlier historical focused-run counts.

## Final measured coverage result

| Runner phase | Suites | Tests | Passed | Failed | Skipped | Duration | Raw evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| Smoke/unit/no-DB | 9 | 41 | 41 | 0 | 0 | PASS in final regression | `raw-results/security-test-coverage/full-regression-20261021-1830/test-all-console.log` and `rerun-20261021-1830/smoke-jest.json` |
| Database/integration | 4 | 8 | 8 | 0 | 0 | PASS in final regression | `raw-results/security-test-coverage/full-regression-20261021-1830/test-all-console.log` and `rerun-20261021-1830/db-jest.json` |

The database phase includes authentication flow, VNPay duplicate Return handling, VNPay IPN behavior, and payment atomicity/recovery. The measured suite count is not a claim that all possible security behaviors are covered. Live provider delivery, distributed failover, browser cross-origin deployment, external email delivery and complete SAST rule coverage remain outside this run.

## Test discovery and unique-count baseline

The current repository inventory contains 16 Jest test files and 55 declared test cases. The maintained runner executes 9 smoke suites (41 cases) and 4 database suites (8 cases). Two additional no-database suites are focused coverage outside the smoke runner (`pricing.integrity.no-db.test.js`: 4; `payment-idempotency.no-db.test.js`: 1), and booking concurrency remains a separate database experiment (1 case). The retained pre-IPN/atomicity reports record 41 smoke cases, 6 database cases, the same 5 focused cases, and the separate booking case; therefore the reconstructed pre-improvement unique baseline is 53. The two new meaningful cases are the VNPay IPN contract/recovery case and payment atomicity/recovery case, giving 55 current unique cases. This baseline is reconstructed from retained reports and current test discovery because the workspace has no Git history.

The table uses primary security objectives for reporting; category rows are not summed because a single test can exercise more than one control. The operational mailer, SMTP, service-image and generic smoke cases remain included in the 55-case unique total but are not forced into a security category. The aggregate `55/55` passed value combines the retained focused and separate booking runs with the latest smoke/database rerun; it is not presented as one Jest invocation.

| Category | Baseline tests | Added tests | Final unique tests | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|---:|---:|
| Authentication | 5 | 0 | 5 | 5 | 0 | 0 |
| Authorization | 3 | 0 | 3 | 3 | 0 | 0 |
| CSRF/session and transport security | 7 | 0 | 7 | 7 | 0 | 0 |
| Booking/concurrency | 1 | 0 | 1 | 1 | 0 | 0 |
| Pricing integrity | 4 | 0 | 4 | 4 | 0 | 0 |
| Payment/idempotency/recovery | 5 | 2 | 7 | 7 | 0 | 0 |
| XSS/SAST regression | 4 | 0 | 4 | 4 | 0 | 0 |
| **All maintained unique test cases** | **53** | **2** | **55** | **55** | **0** | **0** |

The latest rerun is machine-readable at `raw-results/security-test-coverage/rerun-20261021-1830/`; the full regression console and post-secret integration artifacts are at `raw-results/security-test-coverage/full-regression-20261021-1830/`. The mandatory payment-atomicity snapshot set is at `raw-results/payment-atomicity/20261021-1115/`. The VNPay integration sources now require `VNPAY_TEST_SECRET` out-of-band; no literal value is included in evidence.

## Coverage interpretation

Covered security behaviors include invalid/expired token handling, refresh rotation and reuse defenses, authorization boundaries, session-bound and tampered CSRF tokens, rate limiting, booking capacity/concurrency, provider signature and amount validation, duplicate callback handling, Return/IPN races, payment rollback, and retry recovery.

Remaining gaps include live provider retry behavior, browser-level cross-origin deployment testing, distributed database failover, external email delivery guarantees, and complete static-analysis rule coverage. The target of approximately 70–80 cases is a reference goal, not a justification for creating redundant tests. This report retains the measured count and distinguishes maintained tests from overlapping commands.

Commit hash: `COMMIT HASH UNAVAILABLE`.
