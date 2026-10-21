# Final Semgrep and GitHub CI Resolution

Date: 2026-10-22 (Asia/Saigon)

## Executive result

The timeout problem was resolved locally by serializing Semgrep workers with `--jobs 1`. This is a configuration remediation, not a reduction of the analyzed source or rule set. The final scan used Semgrep 1.182.0, the original `p/owasp-top-ten` ruleset, the exact runtime-generated 42-file JavaScript scope, and 70 executed rules. Its JSON and SARIF results contain zero findings, zero scanner errors, zero skipped rules, and zero fixpoint timeouts. The fail-closed gate returned `PASS`, exit code 0.

The remediation is prepared but not pushed. Therefore GitHub-hosted post-fix CI is `NOT VERIFIED`; the historical run `39607269350` is not evidence for this source state.

The final pre-push verification rerun is stored under `raw-results/semgrep-remediation/20261022/final-ci-verification/` and independently records the same 42/42, 0/0/0/0 Semgrep result, gate PASS, 14/14 gate tests, 7/7 focused tests, 68/68 smoke tests, 9/9 database tests, and ESLint PASS.

## Before and after measurements

| Metric | Before | After |
|---|---:|---:|
| Source revision | `761b46462cd2a0f8d44610b35ea60c0d4a6e3f7c` base plus uncommitted remediation | Current uncommitted working tree; no new commit |
| Semgrep version | 1.182.0 | 1.182.0 |
| Rule configuration | `p/owasp-top-ten` | `p/owasp-top-ten` |
| Selected targets | 42 | 42/42 |
| Executed rules | 70 | 70 |
| Findings | 0 in the timeout-bearing raw scan | 0 |
| Scanner errors | 0 | 0 |
| Skipped rules | 0 | 0 |
| Fixpoint timeouts | 4 | 0 |
| Security gate | `INCOMPLETE_ANALYSIS`, exit 1 | `PASS`, exit 0 |
| Regression tests | PASS | PASS: smoke 68/68, focused 7/7, DB 9/9, gate 14/14 |
| Hosted GitHub Actions | NOT VERIFIED | NOT VERIFIED |

The “before” zero-finding value is intentionally retained from the latest timeout-bearing scan; it did not constitute a complete analysis because `time.fixpoint_timeouts` contained four entries. Older pre-remediation artifacts with five findings remain historical and are not overwritten.

## Timeout investigation

The original timeout-bearing JSON recorded four fixpoint timeouts in `admin.js`, `auth.js`, `bookings.js`, and `payments.js`. Pairwise, progressive, rule-isolation, pinned-version, and MRE experiments were run with JSON, command, and console evidence. Single-file scans of the suspected files completed without timeout. The smallest faithful target-level reproduction was `admin.js + auth.js`: each file alone completed, while the pair could produce a fixpoint timeout under the original workload. The isolated raw-HTML rule alone did not reproduce the timeout, so the evidence does not support blaming one sanitizer call or one source line.

### Root-cause evidence by source file

| File | Diagnostic rule evidence | Reproduction evidence | Resolution |
|---|---|---|---|
| `backend/routes/admin.js` | Full scans reported raw-HTML/direct-response taint diagnostics; timeout rule identity varies with scheduling. | Full scope; `admin + auth + bookings` and `admin + auth + payments` triples; MRE pair. `admin.js` alone completed. | Covered by worker serialization; no business-logic refactor. |
| `backend/routes/auth.js` | Pairwise scans reported `express-open-redirect`/`require-request`; full scans also reported direct-response taint diagnostics. | `admin + auth` and `auth + bookings/payments` combinations; MRE pair. `auth.js` alone completed. | Covered by worker serialization; existing sanitizer review remains unchanged. |
| `backend/routes/bookings.js` | Full-scope timeout appeared in taint analysis; no independent two-file minimum reproduction was established. | Full scope and larger triples; single-file and smaller pairwise evidence did not reproduce it. | Covered by worker serialization; booking behavior was not changed. |
| `backend/routes/payments.js` | Full-scope timeout appeared in taint analysis; isolated SSRF/redirect rules completed. | Full scope and larger multi-target sets; payment pairwise scans completed. | Covered by worker serialization; payment/security fixes and regression tests were preserved. |

The verified configuration-level root cause is parallel-worker-dependent, nondeterministic taint fixpoint convergence for this source/ruleset workload. Evidence: the same Semgrep image, ruleset, source, and timeout settings produced different timeout counts at `--jobs 2/4/8/14`, while full 42-target `--jobs 1` scans completed three consecutive repetitions with zero timeouts. The internal engine scheduling mechanism is not observable from Semgrep JSON, so no stronger line-level or upstream-engine claim is made.

Worker-count results are preserved in `raw-results/semgrep-remediation/20261022/analysis/worker-count/summary.json`, with each run’s JSON, command, and console log. The MRE and pinned rule snapshot are in `semgrep-timeout-mre/`.

## Coverage and security-gate proof

The workflow still discovers all `backend/**/*.js` files at runtime and excludes only the documented test/runtime/generated directories. It writes the expected scope before scanning. The final gate compared the expected and scanned sets and found 42 expected, 42 scanned, no missing targets, and no unexpected targets. The final invocation metadata records `p/owasp-top-ten`, Semgrep 1.182.0, and `worker_count: 1`.

The gate is fail-closed. It validates JSON structure, non-empty target scope, exact expected scope, ruleset metadata, findings, scanner errors, skipped rules, and `time.fixpoint_timeouts`. Missing or malformed timeout metadata is not interpreted as zero. The 14 regression tests cover clean, finding, scanner-error, timeout, empty-scan, scope mismatch, malformed evidence, skipped-rule, metadata mismatch, and missing-file cases.

No rule was removed, no target was excluded to obtain the clean result, no finding was suppressed, and no `continue-on-error` or `|| true` was added. JSON/SARIF generation and artifact upload remain configured with `if: always()` so failed gates still preserve evidence.

## Source and configuration changes

- `backend/utils/security.js` provides the shared context-appropriate HTML sanitizer.
- `backend/routes/auth.js` and `backend/routes/payments.js` use the sanitizer at HTML interpolation boundaries; payment URL components retain URL encoding before HTML escaping.
- XSS regression coverage includes hostile allowlisted front paths and sanitizer unit tests.
- `backend/scripts/check-semgrep-result.py` is the fail-closed v2 gate.
- `.github/workflows/semgrep.yml` pins Semgrep 1.182.0, uses the dynamic expected scope, records invocation metadata, runs JSON and SARIF scans with `--jobs 1`, and uploads evidence on failure.

The worker configuration is the only timeout-specific remediation. Booking capacity, authentication/authorization, CSRF, VNPay Return/IPN, transaction atomicity, and retry behavior were not changed for this issue.

## Regression evidence

| Test group | Result | Evidence |
|---|---:|---|
| Smoke | 68/68 | `raw-results/semgrep-remediation/20261022/tests/smoke/npm-test-smoke-scope-hardening.log` and Jest JSON |
| Focused sanitizer/payment | 7/7 | Existing focused raw evidence under `tests/` |
| Security gate | 14/14 | `tests/gate-hardening/jest.json` and `console.log` |
| Database security/payment | 9/9 | Existing isolated `beautycare_test` evidence |
| Lint and syntax | PASS | `tests/lint-scope-hardening.log` and syntax checks |

These groups are separate evidence units and are not added together as one artificial test count. The current smoke source-state result is 68/68; the older 62/62 run is preserved as historical evidence.

## Final Semgrep artifacts

- JSON: `raw-results/semgrep-remediation/20261022/analysis/semgrep/after-worker-serialization/semgrep.json`
- SARIF: `raw-results/semgrep-remediation/20261022/analysis/semgrep/after-worker-serialization/semgrep.sarif`
- Gate summary: `raw-results/semgrep-remediation/20261022/analysis/semgrep/after-worker-serialization/semgrep-gate-summary.json`
- Gate console: `raw-results/semgrep-remediation/20261022/analysis/semgrep/after-worker-serialization/semgrep-gate-final.console.log`
- Expected scope: `raw-results/semgrep-remediation/20261022/analysis/semgrep/after-worker-serialization/target-list-42.txt`
- Invocation metadata: `raw-results/semgrep-remediation/20261022/analysis/semgrep/after-worker-serialization/semgrep-invocation.json`

## GitHub Actions status

No post-fix commit, branch push, pull request, or workflow dispatch was performed. Consequently there is no new commit SHA, run ID, run URL, hosted conclusion, or hosted artifact digest to report. The correct status is `NOT VERIFIED`, not `CI VERIFIED — PASS`. The old run `39607269350` remains historical pre-fix evidence only.

## Research interpretation

The result supports the following bounded statement: after a fail-closed gate was implemented and parallel taint-analysis instability was controlled with a pinned serial worker configuration, the BeautyCare backend’s complete 42-target local OWASP scan produced no findings, scanner errors, skipped rules, or fixpoint timeouts, with reproducible local raw JSON/SARIF evidence. This does not prove zero vulnerabilities, production security, hosted CI success, or live-provider reliability. Those claims require separate evidence.

