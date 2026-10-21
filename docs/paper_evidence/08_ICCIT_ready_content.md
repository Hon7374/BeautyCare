# ICCIT-ready content (evidence-constrained)

## Security Design / CSRF Validation

### A. Verified findings

The backend applies a double-submit-cookie check to unsafe API methods when an access or refresh cookie is present. The client-readable CSRF cookie must equal the `X-CSRF-Token` request header. Existing tests verify rejection of a missing header and acceptance of a matching value; access and refresh cookies are HttpOnly, while the CSRF cookie is intentionally readable.

### B. Limitations

The implementation does not demonstrate a signed CSRF token or binding to an authenticated session. The evidence therefore does not support claims of cryptographic token authenticity or session-bound CSRF validation.

### C. Recommended replacement paragraph

“The prototype uses a double-submit-cookie CSRF defense for state-changing API requests. When an authentication cookie is present, the server requires the readable `csrf_token` cookie to match the `X-CSRF-Token` header. Existing regression evidence confirms rejection of missing tokens and acceptance of matching values. Because the implementation does not sign the CSRF value or bind it to a session identifier, the mechanism should be described as a conventional double-submit-cookie design rather than a signed, session-bound construction.”

## Experimental Setup and Load Testing Procedure

### A. Verified findings

Historical k6 runs used a localhost benchmark server with a non-production performance mode and a constant-VU script issuing `GET /api/services`. The retained completed profiles were 100, 200, and 300 VUs for five minutes.

### B. Limitations

Hardware details were not retained in the reviewed evidence. The scenario excludes authentication, CSRF, booking, voucher, membership, and payment requests. The 400- and 500-VU attempts are overload observations, not completed capacity passes.

### C. Recommended replacement paragraph

“Load testing was conducted against a localhost benchmark instance using a constant-VU k6 scenario that requested the public service-list endpoint. The retained five-minute profiles at 100, 200, and 300 VUs completed with zero recorded HTTP request failures under their respective historical configurations. Higher-load attempts produced connection failures and are reported as overload-limit observations rather than successful capacity results. Since the scenario did not include authenticated or transactional workflows, these measurements should not be generalized to end-to-end checkout capacity.”

## Load Testing Results

### A. Verified findings

The retained summaries report 294,163, 287,191, and 286,276 requests for the 100-, 200-, and 300-VU five-minute profiles, respectively, with 0% HTTP failure rates. Their average latencies were 101.835 ms, 208.797 ms, and 314.271 ms.

### B. Limitations

The 400-VU artifact conflicts with the historical prose: it exists but is failure-heavy. This contradiction must remain visible. The 500-VU run lasted approximately 14.8 seconds and had 14.761% failed requests.

### C. Recommended replacement paragraph

“The completed historical profiles provide evidence for the tested public-read workload up to 300 VUs under the recorded localhost conditions. The 400- and 500-VU attempts encountered severe connection failures; they are not evidence of a passed capacity target. The results should therefore be interpreted as workload-specific observations with an observed failure boundary, not as a general scalability guarantee.”

## Discount Policy Verification

### A. Verified findings

The source implements membership-tier rates, voucher lookup with expiry checking, a configurable maximum combined discount rate capped at 95%, rounded discount amounts, and non-negative final prices. Checkout recomputes the amount server-side.

### B. Limitations

No retained execution evidence verifies these rules. Voucher usage limits, per-customer limits, minimum order values, future activation dates, atomic consumption, and idempotent retry handling were not found in the implementation.

### C. Recommended replacement paragraph

“Static inspection confirmed a server-side pricing path that combines membership and voucher rates, applies a configurable upper bound, rounds the discount, and prevents negative totals. However, the reviewed evidence does not establish runtime correctness for the requested edge cases. In particular, voucher usage limits, per-customer limits, minimum order values, atomic consumption, and idempotent retries are not represented by the current implementation and should not be reported as verified features.”

## Discussion and Threats to Validity

### A. Verified findings

The workspace contains reproducible artifacts for historical security regression, isolated MySQL integration, k6 profiles, VNPay sandbox transactions, and ZAP scanning.

### B. Limitations

The artifacts are historical, environment-specific, and partly inconsistent. The current audit did not rerun them. The absence of usable Git metadata further limits provenance analysis.

### C. Recommended replacement paragraph

“The findings are constrained by artifact provenance, localhost-only performance conditions, a narrow public-read workload, and incomplete runtime coverage of discount policies. Historical evidence is reported separately from the present source audit, and contradictory load artifacts are preserved rather than reconciled by assumption. These limitations reduce external validity and preclude claims about production capacity, cryptographic CSRF binding, or complete voucher-policy enforcement.”

