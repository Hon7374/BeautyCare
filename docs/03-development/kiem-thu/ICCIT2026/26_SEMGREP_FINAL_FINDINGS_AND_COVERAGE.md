# Semgrep Final Findings and Coverage

## Authoritative result sets

The preserved current-source scan (`raw-results/semgrep/current-source-20261021-1639/`) records Semgrep 1.182.0, 42 scanned JavaScript targets, 70 rules, 5 findings, 0 scanner errors, 0 skipped rules, and 4 fixpoint timeouts. The post-test-expansion scan (`raw-results/semgrep/completion-v2-20261021-2045/`) records 41 targets, 70 rules, 5 findings, 0 errors, 0 skipped rules, and 4 timeouts. The target difference is a scope difference caused by excluding test/runner paths; it is not evidence that a finding disappeared.

## Findings

All five baseline findings were the same `javascript.express.security.injection.raw-html-format.raw-html-format` warning in `backend/routes/payments.js`. The remediation is documented in report 29: the project now exposes a shared `sanitizeHtml` helper, applies it in the HTML text and URL attribute contexts, and covers it with regression tests. No rule was suppressed.

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

The defensible historical result is: 5 residual Semgrep warnings, 0 scanner errors, and 4 fixpoint timeouts. The current post-remediation result is recorded separately in reports 29–34: 0 findings and 0 scanner errors, but 4 fixpoint timeouts over the same 42-file source scope. Hosted CI remains pending the prepared push.

## Remediation addendum — 2026-10-22

The before/after experiment, source diff, pinned workflow, and raw JSON/SARIF evidence are in report 32 and `raw-results/semgrep-remediation/20261022/`. Historical raw evidence remains unchanged.
