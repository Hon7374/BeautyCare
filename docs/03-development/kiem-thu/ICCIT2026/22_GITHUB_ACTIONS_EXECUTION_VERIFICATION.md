# ICCIT 2026 — GitHub Actions Execution Verification

Date: 2026-10-21 (Asia/Saigon)

## Final status

**GITHUB HOSTED CI VERIFIED — SECURITY GATE FAILED.** Run `39606730459` executed on commit `46d7525adeecb88456e8ebc307de96fe3bac0a07`; the scan step failed on five Semgrep findings, while SARIF and raw-result uploads succeeded. [Run URL](https://github.com/Hon7374/BeautyCare/actions/runs/39606730459).

## Final status

`GITHUB ACTIONS EXECUTION VERIFIED — SECURITY GATE FAILED`.

The repository is now `Hon7374/BeautyCare`. The hosted run, commit SHA, run URL, job URL, step conclusions, and upload conclusions are available in the GitHub Actions API and run page. The failure is retained as the true security-gate result; it is not converted into a pass claim.

## Local repository and tool inspection

| Check | Observed result | Status |
|---|---|---|
| `.git` metadata | Absent | NOT AVAILABLE |
| `git remote -v` | Cannot run against a repository | NOT AVAILABLE |
| `git branch --show-current` | Cannot run against a repository | NOT AVAILABLE |
| `gh` CLI | Not installed/available | NOT AVAILABLE |
| `actionlint` | Not installed/available | NOT AVAILABLE |
| `yamllint` | Not installed/available | NOT AVAILABLE |
| PyYAML workflow parse | Passed | PASS locally |

## Workflow audit

The workflow at `.github/workflows/semgrep.yml` is locally readable and parses successfully. It has push triggers for `main` and `master`, a pull-request trigger, read-only contents permission plus security-events write permission, `ubuntu-latest`, the `semgrep/semgrep:latest` container, and explicit JSON/SARIF output. It scans `backend` using `p/owasp-top-ten`, excludes secrets/dependencies/logs/generated results/coverage, uses `--error`, uploads SARIF and raw results with `if: always()`, and does not use `continue-on-error`.

The workflow is configured but does not pin the Semgrep container to an immutable version or digest. That is a reproducibility risk for future hosted runs and should be addressed before treating CI output as a stable longitudinal benchmark.

## Verification matrix

| Check | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| YAML parse | Valid workflow document | PyYAML parse and required keys passed | `raw-results/semgrep-ci/20261021-1112/yaml-validation.json` | PASS locally |
| Trigger/permissions | Push, PR, least-privilege security permissions | Present in workflow | `.github/workflows/semgrep.yml` | PASS configured |
| Semgrep source scan | Current source scan succeeds | Semgrep 1.182.0, 42 JS targets, 70 rules, 5 findings, 0 errors, 0 skipped rules | `raw-results/semgrep/current-source-20261021-1639/after.json` and `.sarif` | PASS locally / PARTIAL findings |
| Timeout coverage | All analysis completes | 4 fixpoint timeouts in raw JSON | Same JSON | LIMITATION |
| Gate behavior | Findings/errors fail job | `--error`; no `continue-on-error` | Workflow source | PASS configured |
| JSON/SARIF export | Both formats retained | Both files present | Semgrep current-source directory | PASS locally |
| Hosted run | Real GitHub run with URL/SHA | Run 39606730459 on commit `46d7525`; scan failed on five findings; uploads succeeded | [GitHub Actions run](https://github.com/Hon7374/BeautyCare/actions/runs/39606730459) | VERIFIED — FAILED GATE |

The separate local rerun failed before scanning because Semgrep could not open the Windows certificate store (`CertOpenSystemStore returned NULL`). It is retained at `raw-results/semgrep-ci/20261021-1112/semgrep-rerun-attempt.log` and is not substituted for the successful source-state scan.

## Reproduction and reporting rule

The hosted-CI claim is now supported by the exact run URL, commit SHA, job conclusion, and upload-step conclusions. The correct result is `FAILED GATE` because five Semgrep findings remain; it is not a clean or passing CI result.

## Academic readiness statement

The workflow design is reviewable and the local command/artifacts are reproducible enough to document CI integration. The execution evidence is not complete for a hosted-CI claim because the actual GitHub Actions run is unavailable. The Semgrep result remains partial: five residual findings and four fixpoint timeouts are retained, and no clean-scan claim is made.
