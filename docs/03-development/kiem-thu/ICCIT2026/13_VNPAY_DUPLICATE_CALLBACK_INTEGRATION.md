# VNPay Duplicate Callback Integration Test

Date: 2026-10-21 (Asia/Saigon)

## Setup

- Endpoint under test: `GET /api/payments/vnpay/return`.
- Database: real MySQL database `beautycare_test`, exposed by the local Docker container at `127.0.0.1:3310`.
- Callback signature: HMAC-SHA512 using a test-only `VNPAY_HASH_SECRET`; no production secret and no external VNPay request were used.
- Test source: `backend/tests/vnpay-duplicate-callback.integration.test.js`.
- Command: `DB_NAME=beautycare_test node scripts/run-vnpay-integration.js` (the runner also preserves the raw console log).
- Automated suite command: `DB_NAME=beautycare_test npm run test:db`.

The implementation validates the VNPay signature, then calls `finalizePaid`, which acquires a MySQL named lock keyed by `provider_ref`. The finalization path updates the payment/order state, creates one transaction and one paid `payment_events` row; a callback arriving after a paid terminal state returns without repeating those effects.

## Observed scenarios

| Scenario | Requests | Observed HTTP result | Final database assertion |
|---|---:|---|---|
| Valid callback, sequential duplicate, then late failure callback | 3 | 3 × HTTP 302 redirect | payment/order `paid`; `paidEvents=1`; `transactions=1` |
| Concurrent duplicate, repetition 1 | 50 | 50 × HTTP 302; 50 × `status=paid`; 214 ms | payment/order `paid`; `paidEvents=1`; `transactions=1` |
| Concurrent duplicate, repetition 2 | 50 | 50 × HTTP 302; 50 × `status=paid`; 197 ms | payment/order `paid`; `paidEvents=1`; `transactions=1` |
| Concurrent duplicate, repetition 3 | 50 | 50 × HTTP 302; 50 × `status=paid`; 198 ms | payment/order `paid`; `paidEvents=1`; `transactions=1` |
| Tampered amount with original signature | 1 | HTTP 302 failure redirect | payment `created`; order `pending`; `paidEvents=0`; `transactions=0` |

The timing values and state assertions are copied from the raw result. The HTTP 302 is the endpoint's redirect contract; the `status=paid` redirect count is also checked to expose caught callback failures. The concurrent raw result records zero failure redirects in all three repetitions. Low-level lock-timeout and database-error counters are not separately instrumented by the current route, so they are not claimed as independently measured zeroes.

## Raw evidence

- [Raw JSON result](raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.json)
- [Raw console log](raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.console.log)
- [Integration test source](../../../../backend/tests/vnpay-duplicate-callback.integration.test.js)
- [VNPay provider signature implementation](../../../../backend/utils/providers/vnpay.js)
- [MySQL lock implementation](../../../../backend/utils/mysqlLocks.js)

## Interpretation and limits

This is a database-backed callback integration test, not a live VNPay delivery test. It verifies the application callback contract, HMAC gate, MySQL lock, and persisted side effects with real MySQL. It does not measure VNPay network retries, provider-side delivery timing, TLS termination, or production infrastructure. The result supports the bounded claim that repeated valid callbacks for one `provider_ref` were finalized once in the isolated test database.

## Rerun provenance

The latest execution used `DB_HOST=127.0.0.1`, `DB_PORT=3310`, `DB_NAME=beautycare_test`, and `npm run test:all`. The raw JSON timestamp and all database assertions above were read from `raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.json`. No production database, live VNPay request, or production secret was used. The latest measured concurrent durations were 214 ms, 197 ms, and 198 ms.

The latest source-state execution recorded 249 ms, 210 ms, and 266 ms for the three concurrent repetitions. It also recorded a valid-signature amount-mismatch scenario that returned a failed redirect while leaving `payment=created`, `order=pending`, `paidEvents=0`, and `transactions=0`. This integration test exercises `GET /api/payments/vnpay/return` only; it is not an IPN test.
