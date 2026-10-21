# Semgrep Final Findings and Coverage

## Authoritative result sets

The preserved current-source scan (`raw-results/semgrep/current-source-20261021-1639/`) records Semgrep 1.182.0, 42 scanned JavaScript targets, 70 rules, 5 findings, 0 scanner errors, 0 skipped rules, and 4 fixpoint timeouts. The post-test-expansion scan (`raw-results/semgrep/completion-v2-20261021-2045/`) records 41 targets, 70 rules, 5 findings, 0 errors, 0 skipped rules, and 4 timeouts. The target difference is a scope difference caused by excluding test/runner paths; it is not evidence that a finding disappeared.

## Findings

All five findings are the same `javascript.express.security.injection.raw-html-format.raw-html-format` warning in `backend/routes/payments.js`, at the manually generated payment HTML response. The relevant values are passed through the project `escapeHtml` helper before interpolation (`safeProvider`, `safeRef`, `okUrl`, `failUrl`, and `front`). Four XSS regression tests pass for script, event-handler, encoded, and unsafe-URL payloads. Manual review therefore treats these as residual tool findings requiring sanitizer modeling review, not as permission to suppress the rule and not as proof of a clean scan.

No finding was suppressed, relabeled, or removed from the raw JSON/SARIF artifacts.

## Fixpoint timeouts

The current raw scan retains four timeout contexts:

| File | First rule in timeout context | Interpretation |
|---|---|---|
| `backend/routes/admin.js` | `raw-html-format` | Taint fixed-point did not converge within the configured analysis boundary. |
| `backend/routes/auth.js` | `express-open-redirect` | Analysis coverage is incomplete for this context. |
| `backend/routes/bookings.js` | `raw-html-format` | Analysis coverage is incomplete for this context. |
| `backend/routes/payments.js` | `express-ssrf` | Large route and multiple sinks increase analysis complexity. |

The timeouts are scanner-analysis limitations, not scanner errors. They leave potential blind spots in the affected contexts and require manual review or a future narrower/rule-specific scan. The post-expansion scan reproduced the same four contexts.

## Coverage boundary

The scan uses the OWASP Top Ten ruleset and JavaScript backend scope. It excludes environment files, dependencies, logs, raw-results, results, coverage, tests, the local runtime database area, and the VNPay runner in the scope-corrected rerun. This is useful application-source coverage, not complete repository or full data-flow coverage.

## Conclusion

The defensible result is: 5 residual Semgrep warnings, 0 scanner errors, and 4 fixpoint timeouts. The evidence supports manual-review and regression-test claims; it does not support a zero-vulnerability claim.
