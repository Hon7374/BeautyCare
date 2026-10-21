# CSRF Security Evaluation

## Baseline

The inspected baseline used a synchronizer-like double-submit comparison: the CSRF cookie and `X-CSRF-Token` header had to be equal. The value was not cryptographically bound to the authenticated session.

## Implemented control

The current token format is `v1.<session>.<nonce>.<HMAC-SHA256>`. The session component is derived from the access-token `jti`; if only a refresh cookie is available it is derived from `sha256(refresh_token)`. The middleware requires:

1. an authenticated cookie session;
2. a CSRF cookie and request header;
3. exact cookie/header equality; and
4. a valid HMAC under `CSRF_SECRET`, or `JWT_SECRET` only when the explicitly configured JWT secret is at least 32 characters.

The hard-coded JWT fallback was removed. Production startup now rejects missing/short JWT and CSRF configuration.

## Executed evidence

Command: `npx jest --runInBand tests/security.no-db.test.js tests/payment-idempotency.no-db.test.js tests/pricing.integrity.no-db.test.js tests/payment-mock-xss.no-db.test.js`

Observed result on 2026-10-21: **4 suites passed, 29 tests passed**. The security suite includes rejection of a token signed for a different session, and the payment mock suite verifies HTML escaping of reflected input.

The smoke command also passed: **9 suites, 41 tests**. The DB-backed authentication test then passed **5/5 tests**, including missing-CSRF rejection and refresh-token rotation; the second DB suite covers VNPay callback idempotency.

## Remaining limit

This verifies the isolated local application lifecycle, not a production deployment. Production secret values, HTTPS termination and cross-origin browser behavior still require deployment-level verification.
