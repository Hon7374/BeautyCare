# Semgrep Run 39607269350 — Findings Review and Remediation

Date: 2026-10-22 (Asia/Saigon)

## Baseline identity

- Run: `39607269350`
- Scanned commit: `761b46462cd2a0f8d44610b35ea60c0d4a6e3f7c`
- Workflow: `.github/workflows/semgrep.yml`
- Ruleset: `p/owasp-top-ten`
- Hosted artifact: `semgrep-results`, artifact ID `12349080789`
- Hosted artifact digest: `sha256:3c43b05251a59e38a93d0977ac6d3b084a6aff5b9ae90d2af28f42dfafe92d4a`

The hosted artifact was not downloaded in this session because the GitHub artifact endpoint required authentication. The historical local copy in `FINAL_VERIFIED_EVIDENCE_V2/raw-results/semgrep/current-source-20261021-1639/` was preserved and used as the before-input; it contains five findings and four fixpoint-timeout errors with zero scanner errors.

## Five findings

All five findings were `javascript.express.security.injection.raw-html-format.raw-html-format`, CWE-79. They were emitted from the `/api/payments/mock/pay` HTML response in `backend/routes/payments.js`:

| Finding | Value | Before review | Remediation |
|---:|---|---|---|
| 1 | `safeProvider` | HTML text context | Uses shared `sanitizeHtml`. |
| 2 | `safeRef` | HTML text context | Uses shared `sanitizeHtml`. |
| 3 | `okUrl` | `href` attribute | Query components are URI-encoded, then the complete attribute value is HTML-escaped. |
| 4 | `failUrl` | `href` attribute | Same context-specific handling as `okUrl`. |
| 5 | `front` | HTML text context | The URL is host/protocol allowlisted, then HTML-escaped. |

The old implementation already had effective escaping under the name `escapeHtml`, but the upstream Semgrep rule's sanitizer heuristic did not recognize that project-local name. The remediation makes the control explicit and shared: `sanitizeHtml` encodes `&`, `<`, `>`, double quote, and single quote. The code does not suppress the rule or alter the severity.

The URL order is intentional: `encodeURIComponent` protects query components first; `sanitizeHtml` then protects the HTML attribute delimiter context. The existing host/protocol allowlist remains in force. No user-controlled value is inserted into a JavaScript execution context.

## Regression evidence

- `backend/tests/payment-mock-xss.no-db.test.js`: 5/5 passed.
- `backend/tests/security-html-sanitizer.no-db.test.js`: 2/2 passed.
- Smoke runner after adding the sanitizer and JSON-gate suites: 13 suites, 62/62 tests passed.
- Payment/security integration on isolated `beautycare_test`: 4 suites, 9/9 tests passed.
- ESLint: passed.
- Semgrep 1.182.0, same 42-file source scope: 0 findings, 0 errors, and 4 entries in `time.fixpoint_timeouts`.
- The fail-closed gate therefore reports `INCOMPLETE_ANALYSIS` and exits 1; this is an incomplete-coverage result, not a clean Semgrep pass.

Raw before/after JSON and SARIF are under `raw-results/semgrep-remediation/20261022/`; historical evidence was not overwritten.

## Status before push

The source, tests, workflow pin, reports, and evidence package are prepared locally. No push was performed in this remediation turn. GitHub Actions must be revalidated after user confirmation and push; this report does not claim a new hosted run.
