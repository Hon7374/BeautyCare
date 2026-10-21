# Security Coverage Completion

## Scope and baseline

The preserved discovery baseline contained 55 unique declared Jest tests in 16 files. Fifteen meaningful tests were added in six test files; no test was duplicated to inflate the count. The completion baseline is therefore **55 -> 70 unique tests**.

| Category | Before | Added | Final unique | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|---:|---:|
| Authentication and session lifecycle | 5 | 1 | 6 | 6 | 0 | 0 |
| CSRF and cookie binding | 7 | 2 | 9 | 9 | 0 | 0 |
| Booking authorization, validation, and concurrency | 1 | 8 | 9 | 9 | 0 | 0 |
| Payment input, idempotency, and recovery | 7 | 2 | 9 | 9 | 0 | 0 |
| Pricing integrity | 4 | 2 | 6 | 6 | 0 | 0 |
| XSS regression and SAST-linked behavior | 4 | 0 | 4 | 4 | 0 | 0 |
| **Unique test total** | **55** | **15** | **70** | **70** | **0** | **0** |

Category rows overlap by design and must not be summed. The machine-readable baseline and gap matrix are `raw-results/security-test-coverage/test-discovery-baseline-20261021-v2.json` and `raw-results/security-test-coverage/coverage-gap-matrix-20261021-v2.json`.

## Added coverage

- `security.no-db.test.js`: malformed HMAC CSRF token and missing CSRF cookie with a live session.
- `security.auth-flow.test.js`: replay of the refresh token revoked by rotation.
- `booking-concurrency.integration.test.js`: cross-user cancellation and cancellation of a paid terminal booking.
- `booking-validation.no-db.test.js`: missing identifiers, date/time boundaries, reversed calendar ranges, and excessive range length.
- `payment-input-validation.no-db.test.js`: unsupported provider and missing service identifier.
- `pricing.integrity.no-db.test.js`: deterministic fractional rounding and zero-price handling.

## Execution evidence

The final isolated run is split into separate Jest phases, as required by the existing runner design:

| Phase | Result | Raw evidence |
|---|---|---|
| Smoke/no-DB | 11 suites, 51/51 passed | `raw-results/security-test-coverage/completion-20261021-2100/full-regression.log` and `completion-20261021-1945/smoke.json` |
| Focused added-control run | 36/36 passed | `raw-results/security-test-coverage/completion-20261021-1945/focused.json` |
| DB authentication/payment | 4 suites, 9/9 passed | `raw-results/security-test-coverage/completion-20261021-2005/db.json` |
| Booking DB run | 3/3 passed | `raw-results/security-test-coverage/completion-20261021-1955/booking.json` |
| Full regression | smoke 51/51 plus DB 9/9 | `raw-results/security-test-coverage/completion-20261021-2100/full-regression.log` |
| Lint and syntax | pass; 18 test files checked | `raw-results/security-test-coverage/completion-20261021-2100/lint.log` and `syntax-*.log` |

The full-regression aggregate is not a single 70-test Jest invocation. The authoritative unique total is the discovery count; phase results are reported separately to avoid double counting.

## Residual gaps

The suite does not prove live payment-provider delivery, distributed multi-node behavior, disaster recovery, production email delivery, or complete SAST coverage. Semgrep retains five findings and four fixpoint timeouts; these are reported in report 26 without suppression. GitHub-hosted CI remains unverified.

## Conclusion

The meaningful local security coverage expansion is complete and passes 70/70 unique tests. This supports a bounded local verification claim, not a zero-vulnerability or production-readiness claim.
