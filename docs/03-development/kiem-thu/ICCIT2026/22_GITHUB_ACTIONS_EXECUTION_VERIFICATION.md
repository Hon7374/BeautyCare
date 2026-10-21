# ICCIT 2026 — GitHub Actions Execution Verification

Date: 2026-10-21 (Asia/Saigon)

## Final status

**GITHUB HOSTED CI NOT VERIFIED.** No `.git`, remote, `gh` authentication, hosted run URL, run ID, commit SHA, or conclusion is available. The workflow file is present and security-gated locally, but its execution and SARIF upload have not been observed on GitHub.

## Final status

`GITHUB ACTIONS EXECUTION NOT VERIFIED`.

The workspace has no `.git` directory, no configured remote, no GitHub repository identity, and no `gh` CLI available. Consequently there is no defensible repository URL, commit SHA, workflow run ID, run URL, hosted log, or hosted artifact to report. No hosted execution is claimed.

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
| Hosted run | Real GitHub run with URL/SHA | No repository identity or hosted run available | Workspace inspection | NOT VERIFIED |

The separate local rerun failed before scanning because Semgrep could not open the Windows certificate store (`CertOpenSystemStore returned NULL`). It is retained at `raw-results/semgrep-ci/20261021-1112/semgrep-rerun-attempt.log` and is not substituted for the successful source-state scan.

## Reproduction and reporting rule

Before making a hosted-CI claim, connect the repository or provide a checkout with `.git` metadata, run the workflow on GitHub, and preserve the exact URL, commit SHA, job conclusion, raw JSON, SARIF and artifact download identity. Until then the correct claim is configured and locally validated, not GitHub-executed.

## Academic readiness statement

The workflow design is reviewable and the local command/artifacts are reproducible enough to document CI integration. The execution evidence is not complete for a hosted-CI claim because the actual GitHub Actions run is unavailable. The Semgrep result remains partial: five residual findings and four fixpoint timeouts are retained, and no clean-scan claim is made.
