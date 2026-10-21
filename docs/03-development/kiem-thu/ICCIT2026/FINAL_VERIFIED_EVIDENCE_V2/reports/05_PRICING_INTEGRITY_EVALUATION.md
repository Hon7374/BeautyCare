# Pricing Integrity Evaluation

## Implemented control

Checkout pricing is recalculated on the server from the service price, membership rate and voucher rate. The utility rejects non-finite or negative service prices, clamps discount rates to `[0,1]`, caps the combined discount at the configured maximum (default 95%), rounds discount and final amounts to integer currency units, and never returns a negative total.

The client-submitted amount is not the source of truth for this calculation.

## Executed evidence

`backend/tests/pricing.integrity.no-db.test.js` passed 4 tests covering server recalculation, rounding, discount-cap enforcement, malicious rate input and invalid prices. The result is included in the current focused run of 29 passed tests and the smoke run of 41 passed tests.

## Not verified

A live checkout/payment amount reconciliation was not rerun as part of this code-verification pass. The retained VNPay sandbox evidence is reported separately and does not prove arbitrary client-side amount manipulation is impossible; the relevant server-side pricing tests remain the evidence for this control.
