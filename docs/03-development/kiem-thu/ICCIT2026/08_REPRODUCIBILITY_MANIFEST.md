# Reproducibility Manifest

## V2 synchronization (2026-10-21)

The final inventory is 70 unique tests: preserved baseline 55 plus 15 meaningful additions. Final evidence records smoke 51/51, focused 36/36, DB 9/9, booking 3/3, lint pass, and syntax pass. The post-expansion Semgrep pair is `raw-results/semgrep/completion-v2-20261021-2045/` (41 targets, 70 rules, 5 findings, 0 errors, 4 timeouts); the earlier 42-target current-source pair remains preserved. B2 run 1 is absent and is not claimed. The V2 archive is the synchronized evidence set.

The repository includes `tools/new-experiment-manifest.ps1` with three explicit modes:

- `Check`: captures a redacted environment snapshot and required inputs without running a load test;
- `Start`: creates a run directory, script hash, backend version and environment snapshot;
- `Finalize`: records status, error summary, result SHA-256 and console-log SHA-256.

The benchmark runner is `tools/run-iccit-safe-benchmark.ps1`. It runs the public-read k6 workload only against a disposable localhost backend/MySQL setup and stores JSON summaries under `results/iccIT-replication/`. It does not authorize production, payment or authenticated booking traffic.

## Current retained load evidence

- 100/200/300 VU: three repetitions each, completed on 2026-10-17; aggregate manifest is `results/iccIT-replication/aggregate-summary.json`.
- 400 VU: one separate five-minute artifact, `results/iccIT-replication/k6-load-400vus-run1.json`, with 302,936 HTTP requests and zero HTTP failures.
- 500 VU: partial artifact `results/k6-load-500vus.json`, aborted after connection-refused behavior; it is not a completed capacity run.

The aggregate summary itself states that its 100/200/300 profile is a public `GET /api/services` workload with no authentication and no sleep. It must not be generalized to booking/payment throughput.

## Environment limitation

The DB-backed rerun was executed after Docker Engine became available. Its machine-readable Jest result is `docs/03-development/kiem-thu/ICCIT2026/raw-results/booking-concurrency-20261021-result.json`. The original load JSON and historical VNPay summaries were not edited or overwritten. A future rerun should additionally use the manifest helper before starting the test to capture a dedicated console-log hash.

## Security and payment integration evidence

- Preserved Semgrep baseline: `raw-results/semgrep/before.json`, `before.sarif`, `after.json`, and `after.sarif`.
- Corrected Semgrep scope/timeout run: `raw-results/semgrep-scope-verification/scope-timeout0.json` and `scope-timeout0.sarif`; 37 JavaScript targets, 70 rules, 5 findings, 0 fatal errors, 3 residual fixpoint timeouts.
- VNPay duplicate callback integration: `raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.json` plus `vnpay-duplicate-callback-20261021.console.log`; real isolated MySQL `beautycare_test`, HMAC-signed test callbacks, three 50-request concurrent repetitions, and database assertions.
- Source tests: `backend/tests/vnpay-duplicate-callback.integration.test.js` and `backend/tests/payment-mock-xss.no-db.test.js`.
- The application workspace has no Git repository; the commit hash is therefore unavailable and is not inferred.

## 2026-10-21 rerun record

- Commands: `npm run lint`; `npm run test:smoke`; `DB_HOST=127.0.0.1 DB_PORT=3310 DB_NAME=beautycare_test npm run test:all`.
- Results: lint exit 0; smoke 9 suites/41 tests; isolated full suite smoke 9 suites/41 tests plus DB 2 suites/6 tests.
- Corrected Semgrep rerun: `raw-results/semgrep/rerun-final-20261021-100247/scope-timeout0.json` and `.sarif`; 37 targets, 70 rules, 5 findings, 0 errors, 3 fixpoint timeouts, zero `.env*` paths.
- VNPay raw result: `raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.json`; three 50-request concurrent repetitions recorded 214 ms, 197 ms, and 198 ms.
- The workspace still has no Git metadata; no commit hash is available.

## Final route-verification rerun

- Source change: VNPay Return now checks persisted provider identity and amount before finalization; the test suite adds a valid-signature amount-mismatch case.
- Regression: `npm run lint` exit 0; `DB_HOST=127.0.0.1 DB_PORT=3310 DB_NAME=beautycare_test npm run test:all` passed with smoke 9 suites/41 tests and DB 2 suites/6 tests.
- Final VNPay raw artifact: `raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.json`; latest concurrent durations 249 ms, 210 ms, 266 ms; valid-signature amount mismatch left zero paid events and zero transactions.
- Final Semgrep raw artifact: `raw-results/semgrep/final-rerun-20261021-144721/after.json` and `.sarif`; 37 targets, 70 rules, 5 findings, 0 errors, 5 fixpoint timeouts, zero `.env*` paths.

## Stateful booking, VNPay IPN and final regression evidence

- Stateful booking source: `performance/k6-booking.js`; raw k6 JSON, console logs and DB assertions are in `raw-results/k6-booking/`. B1 final runs are 50 VUs with 3 accepted and 47 rejected per repetition; B2 final runs are 19,659, 19,493 and 19,485 successful iterations. B2 runs 2 and 3 have database assertions showing no capacity violation.
- VNPay IPN source: `performance/k6-vnpay-ipn.js`; fixture preparation is `backend/scripts/prepare-k6-vnpay-ipn.js`; raw fixture, k6 JSON and console logs are in `raw-results/vnpay-ipn/`. P1 completed 86,584 callbacks (100 confirmed, 86,484 duplicate responses); P2 completed 100 independent callbacks (100 confirmed, 0 duplicates).
- Payment atomicity and recovery source tests are retained in `backend/tests/payment-atomicity.integration.test.js` and `backend/tests/vnpay-ipn.integration.test.js`; the raw integration artifact is `raw-results/vnpay-ipn/vnpay-ipn-20261021.json`.
- Final `npm run test:all` raw console output is `raw-results/security-test-coverage/test-all-20261021.console.log`: smoke 9 suites/41 tests passed and database 4 suites/8 tests passed. The two groups are reported separately because the runner invokes them separately.
- CI configuration is `.github/workflows/semgrep.yml`. It is present in the workspace but GitHub Actions execution was not available locally; CI status remains unverified.
- The evidence package includes the VNPay artifacts and is rebuilt only from sanitized files; secrets, `.env` files, card/OTP data, JWTs and user exports are excluded. Commit hash remains `COMMIT HASH UNAVAILABLE`.
- Current-source Semgrep rerun: `raw-results/semgrep/current-source-20261021-1639/after.json` and `after.sarif`; Semgrep 1.182.0, `p/owasp-top-ten`, 42 scanned JavaScript targets, 70 rules, 5 findings, 0 scanner errors and 0 skipped rules. The first SARIF attempt failed on Windows `cp1252` encoding; the successful retry used UTF-8 and is the retained SARIF artifact.

- The latest security rerun is isolated at `raw-results/security-test-coverage/rerun-20261021-1112/` with smoke/db Jest JSON, console logs and run-specific integration artifacts. Integration tests now write only when `ICCIT_ARTIFACT_DIR` is explicitly supplied, preventing a rerun from overwriting historical raw evidence.
- Payment atomicity run package: `raw-results/payment-atomicity/20261021-1115/`; manifest and SHA-256 verification cover the result, database snapshots, console log, Jest output and test source.
- Semgrep CI local validation: `raw-results/semgrep-ci/20261021-1112/`; YAML validation passed, while the additional Semgrep invocation was retained as an environment-level certificate-store failure rather than replacing the successful scan artifact.
