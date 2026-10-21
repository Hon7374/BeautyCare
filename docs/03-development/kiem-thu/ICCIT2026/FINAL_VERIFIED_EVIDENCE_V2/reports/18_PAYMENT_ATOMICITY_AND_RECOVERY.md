# ICCIT 2026 — Payment Atomicity and Recovery

## Implementation finding and correction

Payment finalization updates payment status, payment events, order status, booking/subscription effects, and the transaction ledger. A MySQL named lock alone was insufficient to make these writes atomic. The finalization path now runs all database writes in one MySQL transaction and releases the provider-reference lock in `finally`. The transaction uses the same physical connection that owns the named lock; this is required to avoid exhausting the pool when many independent callbacks arrive concurrently.

The implementation is in `backend/db.js`, `backend/utils/mysqlLocks.js`, and `backend/routes/payments.js`. Failure injection is test-only through `PAYMENT_FAULT_INJECTION` and is not enabled by the normal application configuration.

## Failure-injection evidence

The isolated MySQL test exercised four boundaries: before payment update, after payment update, before transaction insert, and after transaction insert. Each injected failure left the payment `created`, order `pending`, no paid event, and zero transaction rows. Clearing the injection and retrying produced `paid` payment/order state, one paid event, and one transaction. The raw before/after assertions are preserved at:

`raw-results/payment-atomicity/payment-atomicity-20261021.json`

The latest run-specific artifact set is `raw-results/payment-atomicity/20261021-1115/` and contains `results.json`, `database-before.json`, `database-after.json`, `console.log`, `manifest.json`, `payment-jest.json`, and `checksums.sha256`. Its manifest records Node.js `v24.12.0`, MySQL `8.4.11`, isolated database `beautycare_test`, one passed test, and no Git commit because the workspace has no Git metadata. The checksums were verified after generation.

The VNPay IPN integration additionally exercised an injected failure followed by a retry. The first response was provider code `99`; the retry returned `00`, with one paid event and one transaction after recovery. This is recorded in `raw-results/vnpay-ipn/vnpay-ipn-20261021.json`.

## Regression command and result

```powershell
$env:DB_HOST='127.0.0.1'; $env:DB_PORT='3310'; $env:DB_USER='root'
$env:DB_PASSWORD='<supplied out-of-band>'; $env:DB_NAME='beautycare_test'
npx jest --runInBand tests/payment-atomicity.integration.test.js tests/payment-idempotency.no-db.test.js tests/vnpay-ipn.integration.test.js
```

Result after the same-connection transaction correction: 3 suites passed and 3 tests passed. ESLint passed with no errors; the unused fixture variable found during the first lint pass was removed.

## Academic result statement

*Fault-injection testing confirmed that payment finalization is atomic within the local MySQL boundary. Failures injected before and after payment, event, and transaction writes produced no observable partial finalization, and a subsequent retry produced exactly one paid event and one transaction. The evidence supports database-level rollback and retry consistency for the tested payment workflow; external email or provider effects remain outside the rollback boundary.*

## Limitations

The tests do not prove distributed transaction semantics, provider-side rollback, or production failover behavior. Email delivery is an external side effect and is therefore not claimed to be transactionally rolled back. Commit hash: `COMMIT HASH UNAVAILABLE`.
