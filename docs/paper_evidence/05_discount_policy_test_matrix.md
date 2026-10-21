# Discount, voucher, and membership test matrix

## Implemented rules evidenced by source

`backend/utils/pricing.js:68-137` loads the user membership tier, loads tier rates and `max_total_rate`, looks up a voucher by unique code, accepts a voucher when it is not expired, sums member and voucher rates, clamps the total to at most 0.95, rounds the discount, and clamps the final price at zero. Checkout routes recompute this server-side before inserting orders (`backend/routes/payments.js:732-760`, `908-950`).

| Rule ID | Business rule | Code/schema location | Test status |
|---|---|---|---|
| DP-01 | Existing voucher code is looked up | `pricing.js:101-119` | NOT TESTED |
| DP-02 | Unknown voucher is not applied | `pricing.js:108-119` | NOT TESTED |
| DP-03 | Expired voucher is not applied | `pricing.js:110-119` | NOT TESTED |
| DP-04 | Future start date is rejected | No start-date column or check found | NOT IMPLEMENTED |
| DP-05 | Voucher usage count/total limit | No usage fields/table/check found | NOT IMPLEMENTED |
| DP-06 | Per-customer voucher limit | No per-user usage model/check found | NOT IMPLEMENTED |
| DP-07 | Minimum order value | No minimum-value field/check found | NOT IMPLEMENTED |
| DP-08 | Membership tier rate | `pricing.js:62-66`; schema `beautycare.mysql.sql:200-214` | NOT TESTED |
| DP-09 | Multiple discounts are capped | `pricing.js:122-123`; `max_total_rate=0.95` schema lines 217-219 | NOT TESTED |
| DP-10 | Rounding and non-negative final price | `pricing.js:125-126` | NOT TESTED |
| DP-11 | Client cannot directly set final amount | Checkout derives values server-side | NOT TESTED |
| DP-12 | Voucher/discount mutation after booking | No dedicated immutability test; checkout recalculates | NOT TESTED |
| DP-13 | Concurrent limited voucher consumption | No usage counter/atomic consume path exists | NOT IMPLEMENTED |
| DP-14 | Retry/duplicate applies discount twice | No idempotency key or voucher-consumption ledger found | NOT IMPLEMENTED / NOT TESTED |
| DP-15 | Formula invariant | `finalPrice=max(0, originalPrice-discountAmount)` in `pricing.js:125-126` | NOT TESTED |

No voucher/membership/discount test execution log was found in the retained Jest suites. The correct report status is therefore NOT TESTED, not PASS.

