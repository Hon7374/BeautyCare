# BeautyCare: Security and Stateful Transaction Verification Results

## Current authoritative SAST and CI status — 2026-10-22

The current working tree is verified locally with Semgrep 1.182.0, `p/owasp-top-ten`, and the runtime-generated 42-target JavaScript scope. The worker-serialized scan (`--jobs 1`) reports 0 findings, 0 scanner errors, 0 skipped rules, and 0 `time.fixpoint_timeouts`; the fail-closed security gate reports `PASS`, exit 0. The same full scope passed three additional `--jobs 1` repetitions. Smoke is 68/68, focused sanitizer/payment regression is 7/7, database security/payment regression is 9/9, and the security-gate suite is 14/14. This is a local result; post-fix GitHub Actions remains `NOT VERIFIED` because no new commit was pushed.

Primary current artifacts are under `raw-results/semgrep-remediation/20261022/final-ci-verification/`; the earlier worker-count and remediation evidence remains under `analysis/`. The worker-count diagnostics show that higher parallelism is nondeterministic for this taint workload, so `--jobs 1` is treated as a configuration remediation only because it preserves all 42 targets and the same OWASP ruleset. Zero findings, complete static-analysis coverage, a passing local gate, hosted CI execution, and production security are distinct claims.

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

Historical pre-remediation SAST evidence: Semgrep 1.182.0 with `p/owasp-top-ten` reported five residual warnings, zero scanner errors, and four fixpoint timeouts. Those findings were reviewed and remediated; the historical artifacts remain preserved and are not the current result.

## 8. Performance results

Public-read load results at 100, 200, 300, 400, and 500 virtual users are retained as a separate historical workload and are not merged with stateful booking results. For B2 run 2, booking latency was median 26 ms, p95 55 ms, and p99 80 ms; run 3 was median 27 ms, p95 56 ms, and p99 79 ms. `booking_duration` is the booking-request metric. `http_req_duration` includes setup/authentication traffic and is not reported as booking-only. B2 run 1 is missing, so a three-run B2 claim is not made.

## 9. Discussion

The evidence supports the effectiveness of the tested local controls against the evaluated failure modes: same-slot booking contention, callback duplication, amount mismatch, transaction rollback, token rotation replay, CSRF mismatch, and selected input/XSS cases. The stronger result is the consistency of database state after retries and races, rather than a single response-time number.

## 10. Threats to validity

The experiments use one local host and one MySQL test instance. They do not model network partitions, multiple application nodes, provider-side retries, live credentials, production observability, disaster recovery, or long-term workload behavior. Semgrep timeouts leave analysis blind spots. GitHub Actions was executed on commit `46d7525`, but its security gate failed on five findings; this verifies CI execution, not a clean scan. Missing B2 run 1 limits replication claims.

## Remediation addendum — 2026-10-22

Historical pre-worker-serialization remediation snapshot: the five raw-HTML findings were addressed with shared context-appropriate sanitization, but the 42-file scan still recorded four fixpoint timeouts; the fail-closed gate correctly remained incomplete. Its smoke count was 62/62 and must not replace the current source-state smoke result of 68/68.

## 11. Conclusion

BeautyCare's reviewed local implementation passed the final 70-test security inventory, preserved booking capacity under the verified contention workloads, maintained local payment idempotency and rollback behavior, and produced bounded booking latency results. The appropriate classification is **locally verified with explicit partial and unverified areas**, not production-ready and not vulnerability-free.

## 12. Evidence traceability

## Current evidence traceability

The current JSON/SARIF pair, invocation metadata, expected scope, worker-count comparison, gate summary, and regression logs are included in `raw-results/semgrep-remediation/20261022/`. The smallest target-level timeout reproduction remains `admin.js + auth.js`; the full-scope worker-serialized configuration removes the observed fixpoint timeouts without changing scope or rules. Hosted post-fix CI remains `NOT VERIFIED` pending an approved push.

Detailed evidence is retained in reports 24–27, the synchronized reports 08, 10, 15, 19–23, and the V2 evidence archive. Primary raw paths include `raw-results/security-test-coverage/`, `raw-results/k6-booking/`, `raw-results/payment-atomicity/`, `raw-results/vnpay-ipn/`, and `raw-results/semgrep/`. The archive excludes environment files, secrets, tokens, database dumps, and personal-data exports.
