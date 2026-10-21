# BeautyCare ICCIT 2026 - Final Verified Evidence V2

This package is rebuilt from the synchronized 2026-10-21 repository state. Historical raw evidence and the V1 package remain outside this package and are not overwritten.

## Contents

| Area | Location | Purpose |
|---|---|---|
| Reports | `reports/` | Reports 01-27, including the academic paper-ready report |
| Security tests | `raw-results/security-test-coverage/` | Completion Jest JSON/logs, full regression, lint, and syntax evidence |
| Booking | `raw-results/booking/` | B1/B2 k6 raw evidence and booking concurrency evidence |
| VNPay IPN | `raw-results/vnpay-ipn/` | Signed IPN integration evidence |
| Payment atomicity | `raw-results/payment-atomicity/` | Fault-boundary rollback and retry evidence |
| Semgrep | `raw-results/semgrep/` | Preserved 42-target scan and post-expansion 41-target scan |
| CI | `ci/` | Workflow snapshot; hosted run not verified |
| Test sources | `test-sources/` | Sanitized source and test snapshots |
| Manifests | `manifests/` | Test discovery, coverage gaps, and package metadata |

## Authoritative values

- 55 preserved baseline tests + 15 meaningful additions = 70 unique tests.
- Smoke 51/51, focused 36/36, DB 9/9, booking 3/3; lint and syntax pass.
- Semgrep current-source: 42 targets, 70 rules, 5 findings, 0 errors, 4 timeouts.
- Semgrep post-expansion: 41 targets, 70 rules, 5 findings, 0 errors, 4 timeouts.
- B2 run 1 is absent; B2 runs 2 and 3 are the only verified B2 raw runs.
- GitHub hosted CI is not verified.
- No environment files, database dumps, live credentials, JWTs, or personal-data exports are included.
