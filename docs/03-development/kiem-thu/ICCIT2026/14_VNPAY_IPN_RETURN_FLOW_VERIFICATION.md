# VNPay IPN and Return Flow Verification

**Verification date:** 2026-10-21  
**System:** BeautyCare local backend with isolated MySQL database `beautycare_test`  
**Scope:** VNPay Return URL, duplicate-callback idempotency, amount/provider reconciliation, and explicit verification of whether a VNPay IPN endpoint exists.

## 1. Endpoint inventory

| Flow | Method and endpoint | Implementation evidence | Result |
|---|---|---|---|
| VNPay Return | `GET /api/payments/vnpay/return` | `backend/routes/payments.js:1482` | Implemented and tested |
| VNPay IPN | `GET/POST /api/payments/vnpay/ipn` | `backend/routes/payments.js` implements HMAC, reference/amount checks and shared finalization | **IMPLEMENTED AND LOCALLY VERIFIED** |
| MoMo IPN | `POST /api/payments/momo/ipn` | `backend/routes/payments.js` contains a separate MoMo IPN handler | Not evidence for VNPay |

The VNPay payment creation flows set `vnp_ReturnUrl` to the VNPay Return route. The provider adapter in `backend/utils/providers/vnpay.js` verifies the HMAC-SHA512 signature over the `vnp_` parameters. The custom `front` query parameter is not part of the provider signature.

## 2. Return URL verification

The executed integration source is `backend/tests/vnpay-duplicate-callback.integration.test.js`. It uses the isolated test database and calls the local Return URL directly. The raw result is:

`docs/03-development/kiem-thu/ICCIT2026/raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.json`

| Scenario | Observed response/database result | Status |
|---|---|---|
| Normal, sequential duplicate, then late failure | Three HTTP `302` responses; final payment/order state `paid`; `paidEvents=1`; `transactions=1` | PASS |
| Concurrent duplicate callbacks, repetition 1 | 50/50 HTTP `302`; 50/50 redirects to paid; 249 ms; one paid event and one transaction | PASS |
| Concurrent duplicate callbacks, repetition 2 | 50/50 HTTP `302`; 50/50 redirects to paid; 210 ms; one paid event and one transaction | PASS |
| Concurrent duplicate callbacks, repetition 3 | 50/50 HTTP `302`; 50/50 redirects to paid; 266 ms; one paid event and one transaction | PASS |
| Tampered amount with original signature | HTTP `302`; payment remains `created`; order remains `pending`; zero paid events and transactions | PASS |
| Valid signature with persisted amount mismatch | HTTP `302`; payment remains `created`; order remains `pending`; zero paid events and transactions | PASS |

The three concurrent repetitions therefore cover 150 callback requests in total. The test demonstrates idempotent behavior of the implemented Return path under the local isolated database. It does not establish behavior of a live VNPay server-to-server IPN delivery.

## 2.1 User-driven VNPay Sandbox browser cross-check

A separate browser-driven Sandbox payment was also cross-checked in the local application database. The sanitized raw artifact is `raw-results/vnpay-sandbox/vnpay-browser-run-20261021.json`.

The transaction was created at `2026-10-21T08:12:31.000Z` for `427500 VND` and reached `paid` at `2026-10-21T08:13:42.000Z`. The associated order was `paid`, the payment event sequence was `pending` then `paid`, and one matching transaction row was present. Card data, OTP, provider credentials, and the full provider reference were not stored; only a SHA-256 reference digest is retained. This is evidence of one Sandbox browser Return-flow execution, not VNPay IPN evidence.

## 3. Source-level protection and finalization

After HMAC and reference validation, the Return route loads the persisted payment and verifies both:

- persisted provider is `vnpay`; and
- integer `vnp_Amount` equals the persisted amount multiplied by 100.

On mismatch, the route redirects to the failed payment result without finalizing payment state. On a valid successful Return, `finalizePaid` uses the MySQL named lock implementation in `backend/utils/mysqlLocks.js` to serialize finalization for the provider reference.

The implementation now wraps finalization writes in one explicit transaction on the same MySQL connection that owns the provider-reference lock. Failure-injection tests and the IPN retry scenario verify rollback and recovery locally. Distributed transaction semantics and external provider/email effects remain outside the claim.

## 4. Reproduction command

```powershell
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3310'
$env:DB_USER='root'
$env:DB_PASSWORD=''
$env:DB_NAME='beautycare_test'
npm run test:all
```

The final local verification recorded lint PASS, smoke tests PASS with 9 suites/41 tests, and database tests PASS with 4 suites/8 tests. The Return artifact above remains authoritative for Return counts; IPN counts and recovery outcomes are in `raw-results/vnpay-ipn/`.

## 5. Conclusion

BeautyCare has a verified VNPay browser Return flow and a separately implemented VNPay IPN flow with signature, provider, amount, duplicate-finalization, rollback and retry checks. The bounded claim is local application verification; live VNPay server-to-server delivery and production reliability remain unverified.
