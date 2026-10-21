# Semgrep Hosted CI Verification

## Status

**GITHUB HOSTED CI NOT VERIFIED**

The workspace has no `.git` directory, no configured remote, no commit hash, and no authenticated `gh` CLI. No hosted workflow run URL, run ID, commit SHA, or GitHub conclusion is available. This report therefore does not label the workflow as passed.

## Local workflow audit

`.github/workflows/semgrep.yml` is present and requests pull-request and `main`/`master` push triggers. It uses `ubuntu-latest`, `semgrep/semgrep:latest`, `p/owasp-top-ten`, `--error`, JSON and SARIF output, and uploads SARIF/artifacts with `if: always()`. The workflow grants `contents: read` and `security-events: write`.

The workflow is structurally reviewable, but local actionlint/yamllint and hosted execution are unavailable. The floating `semgrep/semgrep:latest` tag is a reproducibility risk; pinning a reviewed image tag or digest is recommended as a separate CI maintenance change.

## Local corroboration

The current-source Semgrep pair remains at `raw-results/semgrep/current-source-20261021-1639/` with 42 JavaScript targets, 70 rules, 5 findings, 0 scanner errors, and 4 fixpoint timeouts. A post-test-expansion scope-corrected pair at `raw-results/semgrep/completion-v2-20261021-2045/` scanned 41 JavaScript targets with the same 70 rules, 5 findings, 0 errors, and 4 timeouts. Neither is a hosted CI result.

## Verification boundary

Local configuration inspection verifies that a security gate is configured to fail on Semgrep errors/findings. It does not verify GitHub token permissions, action execution, SARIF ingestion, artifact retention, branch protection, or the result on a particular commit.
