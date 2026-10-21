# Semgrep Findings Root Cause and Fix

Date: 2026-10-22 (Asia/Saigon)

## Scope

This report analyzes the five findings from GitHub Actions run `39607269350` and compares them with the remediation scan. The before artifact is the preserved Semgrep 1.182.0 JSON/SARIF evidence for the same 42 backend JavaScript source files and `p/owasp-top-ten` ruleset.

## Root cause

The five rows were one `raw-html-format` rule at the `/api/payments/mock/pay` HTML sink. Code review found that the endpoint already applied a correct HTML escaping algorithm through a project-local function named `escapeHtml`. The rule's sanitizer heuristic did not recognize that name, so it treated the already escaped values as tainted. The rule is useful here: it exposed a static-analysis contract gap and also highlighted that URL encoding and HTML attribute escaping must be applied in sequence.

## Fix

`sanitizeHtml` is now a shared helper in `backend/utils/security.js`. Payment HTML values use it after URL component encoding where applicable. The auth email template also escapes every dynamic HTML interpolation (`heading`, `type`, `actionUrl`, token, and expiry), making the sanitizer contract explicit in another HTML template sink. No Semgrep rule, finding, severity, or gate was suppressed.

## Verification

The payment XSS regression suite passes 5/5. The sanitizer unit suite passes 2/2. The smoke runner including sanitizer and gate tests passes 62/62. Semgrep on the unchanged 42-file source scope returns 0 findings and 0 scanner errors, but its timing metadata records 4 fixpoint timeouts; the custom gate therefore reports `INCOMPLETE_ANALYSIS`. The isolated payment integration suite on `beautycare_test` passes 9/9 tests across four suites.

Raw evidence: `raw-results/semgrep-remediation/20261022/semgrep/before/`, `.../semgrep/after/`, and `.../tests/`.

