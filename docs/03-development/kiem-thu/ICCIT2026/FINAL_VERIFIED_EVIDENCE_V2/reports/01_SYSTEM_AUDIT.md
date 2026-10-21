# ICCIT 2026 — System Audit

Date of this verification: 2026-10-21 (Asia/Saigon).

## Scope

This audit covers the repository implementation, the no-database regression tests that were executable locally, and the retained load-test artifacts. It does not treat source code or a planned test as runtime evidence. The Word proceedings/paper files named in the task were not present in this workspace, so no claim is made about their contents.

## Architecture and controls

| Area | Current implementation | Evidence status |
|---|---|---|
| API/runtime | Express backend, MySQL-compatible adapter, JWT access/refresh cookies, Helmet/CORS/rate limiting | Implemented; smoke verified |
| CSRF | `v1` HMAC token bound to access-token `jti`, or hashed refresh token; cookie and header must match | Implemented; 29 focused security/integrity tests pass |
| Authentication secret | Removed hard-coded `SECRET_KEY` fallback; production startup requires a configured secret of at least 32 characters | Implemented; lint/smoke verified |
| Booking capacity | MySQL named lock serializes count-and-insert for service/date/time | Implemented; 50-request DB concurrency test verified |
| Payment IPN | Named lock around paid finalization plus one `payment_events` record for the paid transition | Implemented; mocked idempotency test passes |
| Pricing | Server-side recalculation, finite/non-negative price validation, rate clamping, discount cap and integer rounding | Implemented; 4 pricing tests pass |
| SAST | Semgrep 1.182.0, `p/owasp-top-ten`; five findings before and five residual tool findings after remediation | Executed; partial/manual review |

## Important limits

The booking and authentication controls have now been verified against the isolated `beautycare_test` database. Payment idempotency still has unit-level evidence plus retained VNPay sandbox evidence, but duplicate callback/retry remains separately unmeasured.

## Relevant files

- `backend/middleware/csrf.js`
- `backend/utils/security.js`
- `backend/routes/bookings.js`
- `backend/routes/payments.js`
- `backend/utils/pricing.js`
- `backend/utils/mysqlLocks.js`
- `backend/tests/security.no-db.test.js`
- `backend/tests/booking-concurrency.integration.test.js`

## 2026-10-21 rerun addendum

The local rerun used Docker MySQL at `127.0.0.1:3310` and the isolated database `beautycare_test`. ESLint passed, the smoke suite passed with 9 suites and 41 tests, and the DB suite passed with 2 suites and 6 tests. The VNPay callback integration covered one normal/sequential/late-failure flow, three repetitions of 50 concurrent valid callbacks, and one tampered-amount callback. Each concurrent repetition ended with one paid event and one transaction. This is application-callback evidence, not live-provider delivery evidence.

The final route verification additionally found and fixed missing VNPay Return amount reconciliation. A validly signed callback whose `vnp_Amount` did not equal the persisted payment amount is now rejected without changing payment, order, event, or transaction state. This historical addendum predates the subsequent VNPay IPN implementation; see `17_VNPAY_IPN_IMPLEMENTATION_AND_PERFORMANCE.md` and the final verification matrix for the superseding status.

## Superseding VNPay IPN update — 2026-10-21

VNPay IPN is now implemented at `GET/POST /api/payments/vnpay/ipn` with HMAC, provider, amount, reference, named-lock and transactional finalization checks. Local integration and k6 evidence are retained under `raw-results/vnpay-ipn/`. The live provider delivery path remains unverified.
