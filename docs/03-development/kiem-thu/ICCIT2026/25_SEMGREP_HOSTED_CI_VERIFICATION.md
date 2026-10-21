# Semgrep Hosted CI Verification

## Status

**GITHUB HOSTED CI VERIFIED — SECURITY GATE FAILED**

Run `39606730459` executed on commit `46d7525adeecb88456e8ebc307de96fe3bac0a07` at [GitHub Actions](https://github.com/Hon7374/BeautyCare/actions/runs/39606730459). The job completed with `failure` at the Semgrep scan step because the configured `--error` gate detected five findings. SARIF and raw-result upload steps completed successfully. This is a verified hosted execution, not a passing CI result.

## Local workflow audit

`.github/workflows/semgrep.yml` is present and requests pull-request and `main`/`master` push triggers. It uses `ubuntu-latest`, `semgrep/semgrep:latest`, `p/owasp-top-ten`, `--error`, JSON and SARIF output, and uploads SARIF/artifacts with `if: always()`. The workflow grants `contents: read` and `security-events: write`.

The workflow is structurally reviewable, but local actionlint/yamllint and hosted execution are unavailable. The floating `semgrep/semgrep:latest` tag is a reproducibility risk; pinning a reviewed image tag or digest is recommended as a separate CI maintenance change.

## Local corroboration

The current-source Semgrep pair remains at `raw-results/semgrep/current-source-20261021-1639/` with 42 JavaScript targets, 70 rules, 5 findings, 0 scanner errors, and 4 fixpoint timeouts. A post-test-expansion scope-corrected pair at `raw-results/semgrep/completion-v2-20261021-2045/` scanned 41 JavaScript targets with the same 70 rules, 5 findings, 0 errors, and 4 timeouts. The hosted run corroborates the security-gate failure but does not make the scan clean.

## Verification boundary

The hosted run verifies action execution, SARIF upload, artifact upload, and the result on commit `46d7525`. It does not verify branch protection, live-provider behavior, or complete static-analysis coverage.
