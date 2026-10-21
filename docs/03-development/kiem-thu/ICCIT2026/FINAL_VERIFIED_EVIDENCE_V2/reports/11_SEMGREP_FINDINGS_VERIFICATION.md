# Semgrep Findings Verification

Date: 2026-10-21 (Asia/Saigon)

## Source artifacts

The original artifacts were read directly and preserved:

- `raw-results/semgrep/before.json`: Semgrep 1.182.0, 5 findings, 0 errors, 40 entries in `paths.scanned`, 5 `fixpoint_timeouts`.
- `raw-results/semgrep/after.json`: Semgrep 1.182.0, 5 findings, 0 errors, 40 entries in `paths.scanned`, 4 `fixpoint_timeouts`.
- Both scans used `p/owasp-top-ten`; all five findings used the same rule and file.

The five scanner findings are five locations in one mock-payment HTML construction flow, not five independent confirmed vulnerabilities.

## Finding-level comparison

| ID | Before location | After location | Rule/severity | Data-flow interpretation | Final classification |
|---:|---|---|---|---|---|
| 1 | `backend/routes/payments.js:1443–1444` | `backend/routes/payments.js:1455–1456` | `javascript.express.security.injection.raw-html-format.raw-html-format`; WARNING; MEDIUM confidence; HIGH likelihood; MEDIUM impact | `req.query.provider` is normalized, then HTML-escaped before provider text is rendered | CONFIRMED AND FIXED; residual scanner warning due sanitizer modeling |
| 2 | `backend/routes/payments.js:1444–1445` | `backend/routes/payments.js:1456–1457` | Same rule and severity | `req.query.ref` is converted to a string, HTML-escaped, then rendered as HTML text | CONFIRMED AND FIXED; residual scanner warning due sanitizer modeling |
| 3 | `backend/routes/payments.js:1446–1447` | `backend/routes/payments.js:1458–1459` | Same rule and severity | URL query parameters are built with `encodeURIComponent`; the HTML link sink remains visible to the OSS taint rule | CONFIRMED AND FIXED; URL encoding and allowlisting are retained |
| 4 | `backend/routes/payments.js:1447–1448` | `backend/routes/payments.js:1459–1460` | Same rule and severity | The failure link uses the same validated/encoded URL path; displayed frontend text is escaped | CONFIRMED AND FIXED; residual scanner warning due sanitizer modeling |
| 5 | `backend/routes/payments.js:1448–1449` | `backend/routes/payments.js:1460–1461` | Same rule and severity | Normalized frontend URL is HTML-escaped for display and separately URL-encoded for query transport | CONFIRMED AND FIXED; residual scanner warning due sanitizer modeling |

Each raw result carries CWE-79 and the OWASP mappings A07:2017 XSS, A03:2021 Injection, and A05:2025 Injection. The rule message is that user data reaches manually constructed HTML. No finding is classified as a verified false positive merely because `escapeHtml` was added.

## Source → transformation → sanitization → sink

1. `ref` originates at `req.query.ref` and is user-controllable. It is converted with `String(...)`, then passed to `escapeHtml`, and only the escaped value is inserted into the visible HTML text. The separate URL uses the original reference only through `encodeURIComponent`.
2. `provider` originates at `req.query.provider`, is lower-cased and restricted to `[a-z0-9_-]`, then HTML-escaped before display. The URL copy is separately encoded.
3. `front` originates at `req.query.front`. `normalizeFrontendBase` accepts only `http:`/`https:` and allowlisted hosts (`localhost` and `127.0.0.1` by default), removes a trailing slash, and returns a normalized URL. The display copy is HTML-escaped; the link copy is URL-encoded.
4. No affected value is inserted into a JavaScript context. The escaping is used for HTML text, while URL validation and URL encoding are used for URL attributes/query values. Payment amount/status data is not transformed by this fix, so there is no payment-value double encoding.

## Independent XSS verification

`backend/tests/payment-mock-xss.no-db.test.js` now covers four cases: HTML/script text, HTTP URL allowlisting versus `javascript:` input, encoded/event-handler/provider payloads, and an empty reference. Result: **1 suite, 4 tests passed**. The HTTP body was inspected directly; no raw script, event-handler markup, or dangerous URL scheme was returned.

The custom fixture and rule are retained under `raw-results/semgrep-scope-verification/fixtures/`. The custom taint rule reported exactly one finding at the intentionally unsafe interpolation and did not report the value passed through `escapeHtml`. This supports the conclusion that the original `p/owasp-top-ten` residuals are a sanitizer-modeling limitation, while the application fix remains covered by runtime regression tests. The custom result is not substituted for the original ruleset result.

## Conclusion

The underlying issue was a real reflected-HTML/XSS defect in a mock endpoint and has been remediated. The five post-remediation Semgrep rows remain **residual tool findings requiring manual review**, not five unresolved independent vulnerabilities and not zero vulnerabilities. The original and corrected raw results remain separate and unmodified.
