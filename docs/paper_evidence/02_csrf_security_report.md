# CSRF security verification

## Mechanism classification

**Classification: naive double-submit cookie.** The backend generates a random token and sets a readable `csrf_token` cookie. For unsafe methods, the middleware compares that cookie with `X-CSRF-Token` using string equality. The source contains no HMAC/signature over the token and no session identifier, user identifier, or refresh-token hash incorporated into the CSRF value. Therefore “signed double-submit” and “session-bound” must not be claimed.

Relevant evidence: `backend/middleware/csrf.js:1-18`; `backend/utils/security.js:91-103`; `backend/routes/auth.js:127-130`.

## Test matrix

| Test ID | Route/scope | Precondition | Expected | Actual evidence | Status |
|---|---|---|---|---|---|
| CSRF-01 | Safe GET | No session | Allowed | Unit test expects 200 | VERIFIED BY EXISTING EVIDENCE |
| CSRF-02 | POST middleware | No auth cookie | Middleware allows request | Unit test expects 200 | VERIFIED BY EXISTING EVIDENCE |
| CSRF-03 | POST middleware | Session cookie, no header | 403 | Unit test expects 403 and CSRF message | VERIFIED BY EXISTING EVIDENCE |
| CSRF-04 | POST middleware | Cookie/header equal | Allowed | Unit test expects 200 | VERIFIED BY EXISTING EVIDENCE |
| CSRF-05 | POST /api/auth/refresh | Auth cookie, missing header | 403 | Historical DB flow log records 403; integration test asserts 403 | VERIFIED BY EXISTING EVIDENCE |
| CSRF-06 | POST /api/auth/refresh | Correct header | 200 and token rotation | Integration test asserts 200 and new refresh cookie | VERIFIED BY EXISTING EVIDENCE |
| CSRF-07 | POST/PUT/PATCH/DELETE route coverage | Every unsafe route | 403 without matching token | Middleware is global for `/api`; exhaustive live route matrix was not run | NOT TESTED |
| CSRF-08 | Replay after logout/session change | Prior token | Rejection if binding/rotation is claimed | No source evidence of binding; no dedicated replay test retained | NOT TESTED / NOT IMPLEMENTED BINDING |

## Cookie and session observations

Access and refresh cookies are `HttpOnly`; refresh is `SameSite=Strict` and path-limited to `/api/auth`; access is `SameSite=Lax`; CSRF is intentionally readable and `SameSite=Lax` (`backend/utils/security.js:49-103`). `Secure` is environment-dependent. Refresh rotation and logout revocation are present, but they do not bind the CSRF token to the authenticated session.

## Residual risk

The implementation has the normal double-submit-cookie dependency on cookie integrity. If an attacker can inject/overwrite the CSRF cookie in the applicable browser/domain configuration, the matching header can be forged. The evidence supports CSRF mismatch rejection, not cryptographic authenticity or session binding.

No new runtime CSRF test was executed on 2026-10-17 because the configured database/localhost test lifecycle was not independently provisioned for this audit.

