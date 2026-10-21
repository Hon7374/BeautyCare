# BeautyCare: Security and Stateful Transaction Verification Results

## Abstract

This section reports reproducible local verification of the BeautyCare demonstration system. The evaluation combines security regression testing, database-backed booking contention, signed payment callback handling, transaction-failure recovery, static analysis, and stateful performance workloads. Results are deliberately bounded to the tested implementation and environment: they do not claim zero vulnerabilities, live-provider reliability, distributed-system capacity, or production readiness.

## 1. Experimental setup

Experiments were executed on a local Windows environment with Node.js v24.12.0, MySQL 8.4.11, and the isolated `beautycare_test` database exposed at `127.0.0.1:3310`. The workspace has no Git metadata or commit hash. Test-only credentials and callback secrets were supplied out of band and are excluded from the evidence package. No production database, live payment credentials, or personal-data export was used.

## 2. Security design verification

The evaluated implementation binds the HMAC CSRF token to the access-session context, uses HttpOnly/SameSite cookies, rotates and revokes refresh tokens, and rejects replay of a rotated token. Booking creation serializes the count-and-insert critical section with a MySQL named lock. Payment finalization validates the signed callback, provider, and amount, and records idempotent payment events in the same transaction boundary. User-controlled values in the reviewed payment HTML response are escaped before interpolation.

## 3. Stateful booking consistency

The B1 contention workload was repeated three times. Across each run, 3 requests were accepted and 47 were rejected for the same saturated slot; the final database count was 3. The B2 workload has verified raw evidence for run 2 and run 3 only: 19,493 and 19,485 successful iterations, respectively. Both database assertions report `maxBookingsPerSlot = 1` and `capacityViolation = false`. B2 run 1 is absent and is therefore not claimed as verified.

## 4. VNPay Return and IPN verification

Signed local callback tests covered duplicate delivery and concurrent callback races. The historical IPN P1 run processed 86,584 callbacks, with 100 confirmed transitions and 86,484 duplicates; P2 processed 100 callbacks with 100 confirmed transitions and no duplicate side effects. Return-flow concurrency was exercised with three repetitions of 50 requests, producing one payment event and one transaction per effective payment. One browser Sandbox Return flow was observed for 427,500 VND. These results verify local signed-callback behavior only; they do not verify live-provider IPN delivery.

## 5. Atomicity and recovery

Four injected payment fault boundaries were exercised. Each fault rolled back the transaction, and the retry produced one effective payment event and one transaction. The preserved raw run is under `raw-results/payment-atomicity/20261021-1115/`; the final DB regression also includes the atomicity suite.

## 6. Automated security coverage

The preserved baseline was 55 unique tests. Fifteen meaningful tests were added for malformed/session-bound CSRF, refresh-token replay, booking authorization and validation boundaries, payment input validation, and pricing rounding/zero-price behavior. The final inventory is 70 unique tests, with 70/70 passing and no skipped tests. Smoke/no-DB execution passed 51/51, the focused completion group passed 36/36, DB-backed security/payment execution passed 9/9, and the separate booking run passed 3/3. These are separate phases; their counts are not summed into an artificial single invocation.

## 7. Static analysis

Semgrep 1.182.0 with `p/owasp-top-ten` reported five residual warnings, zero scanner errors, and four fixpoint timeouts in the authoritative current-source artifact. The warnings are raw-HTML-format findings at escaped interpolation sites in `backend/routes/payments.js`. A scope-corrected post-expansion scan reproduced five findings, zero errors, and four timeouts over 41 targets. No warning was suppressed. The SAST result is therefore partial and requires manual review; it is not a clean-scan claim.

## 8. Performance results

Public-read load results at 100, 200, 300, 400, and 500 virtual users are retained as a separate historical workload and are not merged with stateful booking results. For B2 run 2, booking latency was median 26 ms, p95 55 ms, and p99 80 ms; run 3 was median 27 ms, p95 56 ms, and p99 79 ms. `booking_duration` is the booking-request metric. `http_req_duration` includes setup/authentication traffic and is not reported as booking-only. B2 run 1 is missing, so a three-run B2 claim is not made.

## 9. Discussion

The evidence supports the effectiveness of the tested local controls against the evaluated failure modes: same-slot booking contention, callback duplication, amount mismatch, transaction rollback, token rotation replay, CSRF mismatch, and selected input/XSS cases. The stronger result is the consistency of database state after retries and races, rather than a single response-time number.

## 10. Threats to validity

The experiments use one local host and one MySQL test instance. They do not model network partitions, multiple application nodes, provider-side retries, live credentials, production observability, disaster recovery, or long-term workload behavior. Semgrep timeouts leave analysis blind spots. GitHub Actions was executed on commit `46d7525`, but its security gate failed on five findings; this verifies CI execution, not a clean scan. Missing B2 run 1 limits replication claims.

## 11. Conclusion

BeautyCare's reviewed local implementation passed the final 70-test security inventory, preserved booking capacity under the verified contention workloads, maintained local payment idempotency and rollback behavior, and produced bounded booking latency results. The appropriate classification is **locally verified with explicit partial and unverified areas**, not production-ready and not vulnerability-free.

## 12. Evidence traceability

Detailed evidence is retained in reports 24–27, the synchronized reports 08, 10, 15, 19–23, and the V2 evidence archive. Primary raw paths include `raw-results/security-test-coverage/`, `raw-results/k6-booking/`, `raw-results/payment-atomicity/`, `raw-results/vnpay-ipn/`, and `raw-results/semgrep/`. The archive excludes environment files, secrets, tokens, database dumps, and personal-data exports.
