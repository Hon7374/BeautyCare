# Semgrep Fixpoint Timeout Root Cause and Fix

Date: 2026-10-22 (Asia/Saigon)

## Observed baseline

The baseline JSON contained four fixpoint-timeout contexts: `backend/routes/admin.js`, `backend/routes/auth.js`, `backend/routes/bookings.js`, and `backend/routes/payments.js`. It contained zero scanner errors. The first reported rule varied with target ordering; grouped experiments showed `raw-html-format` and `express-open-redirect` in the affected analysis state, while an isolated `express-ssrf` scan completed without a timeout.

## Differential diagnosis

Each of the 42 source files was scanned independently with Semgrep 1.182.0, `p/owasp-top-ten`, `--no-git-ignore`, `--timeout 0`, and `--timeout-threshold 0`. Every individual file returned zero findings, zero errors, and zero timeouts. Pair/group scans reproduced timeouts only when several large route files were analyzed together, and the affected first file/rule changed with grouping. This establishes an inter-file taint/fixpoint interaction rather than a deterministic failing sink in one file.

The auth route contained a dynamic HTML email template with unescaped interpolations. The payment route contained dynamic HTML response values whose sanitizer name was not recognized. Making the sanitizer explicit and applying it to all dynamic HTML contexts reduced the taint state that Semgrep had to iterate over.

## Post-fix result

The same 42-file scan after remediation returned zero findings and zero scanner errors, but `time.fixpoint_timeouts` still contains four entries. The custom gate returns `INCOMPLETE_ANALYSIS` and exit code 1. No timeout was excluded, ignored, or converted to a warning. The before full-scan JSON, per-file diagnostics, group diagnostics, isolated-rule diagnostics, engine 1.181.0 comparison, and after JSON/SARIF are preserved under `raw-results/semgrep-remediation/20261022/analysis/` and `semgrep/`.

## Conclusion

The evidence supports a source-level remediation of the five HTML findings, but not resolution of the timeout coverage gap. The timeout remains a multi-file/rule interaction: every affected file passes when isolated, while grouped/full scans reproduce the fixpoint condition. The result should still be rechecked by the pinned GitHub Actions container after push because hosted CI is a separate execution environment.

## Final target-level reproduction

The investigation was extended with six pairwise scans, four triple scans and progressive prefixes of the exact target list. The smallest faithful target group found is `admin.js + auth.js`: the pair produces two timeout records under `p/owasp-top-ten`, while each file alone produces zero. Progressive prefixes 1–7 completed and prefix 8, when `auth.js` was added after `admin.js`, reproduced the condition. This verifies target-set dependence; it does not prove the internal engine convergence mechanism.

