# ICCIT 2026 — Semgrep CI Integration

## Final verification addendum

The historical workflow execution was **GITHUB HOSTED CI VERIFIED — SECURITY GATE FAILED**. The current baseline run is `39607269350` on commit `761b46462cd2a0f8d44610b35ea60c0d4a6e3f7c`; it failed at the Semgrep scan step because five findings triggered `--error`, while SARIF and raw-result upload succeeded. See reports 28 and 31 and the [hosted run](https://github.com/Hon7374/BeautyCare/actions/runs/39607269350).

## Workflow status

Workflow source is `.github/workflows/semgrep.yml`. It is configured for pushes to `main`/`master` and pull requests, uses the pinned `semgrep/semgrep:1.182.0` container, scans `backend`, writes JSON and SARIF artifacts, uploads SARIF to code scanning, and uploads the raw files as a workflow artifact with 14-day retention.

The workflow excludes `.env`, `.env.*`, `node_modules`, logs, raw results, generated results, and coverage directories. It does not suppress findings. `--error` makes any Semgrep finding fail the job; this is intentionally strict and should be changed only with an explicitly documented severity policy.

## Local validation

The current-source local scan was executed with Semgrep 1.182.0 and `p/owasp-top-ten`, with UTF-8 forced for SARIF output after the first Windows `cp1252` write failure. The successful artifact selected 42 JavaScript targets, ran 70 rules, reported 5 findings, 0 scanner errors, no skipped rules and 4 fixpoint timeouts. JSON and SARIF are preserved under:

`raw-results/semgrep/current-source-20261021-1639/after.json`

`raw-results/semgrep/current-source-20261021-1639/after.sarif`

The five findings remain residual tool findings at escaped HTML interpolation sites. They are not relabeled as confirmed exploitable vulnerabilities, and the scan is not represented as clean. The raw JSON records four fixpoint timeouts; this is retained as a coverage limitation.

## Verification boundary

The workspace has no `.git` metadata and no GitHub Actions runner was available locally. Therefore the status is:

| Item | Status |
|---|---|
| Workflow configuration created | YES |
| Local Semgrep command and artifacts validated | YES |
| GitHub CI execution verified | YES — failed security gate |
| Commit hash | `46d7525adeecb88456e8ebc307de96fe3bac0a07` |

## Verification matrix

| Check | Expected | Actual | Evidence | Status |
|---|---|---|---|---|
| YAML validation | Workflow parses and required job keys are present | PyYAML parse passed; triggers, permissions, container and steps detected | `raw-results/semgrep-ci/20261021-1112/yaml-validation.json` | PASS locally |
| Trigger configuration | Push to `main`/`master` and pull request trigger | Both triggers configured | Same validation JSON; `.github/workflows/semgrep.yml` | PASS configured |
| Semgrep execution | Scan backend with OWASP ruleset | Successful retained local source-state run: Semgrep 1.182.0, 42 JS targets, 70 rules, 0 scanner errors | `raw-results/semgrep/current-source-20261021-1639/after.json` | PASS locally; additional rerun blocked by Windows certificate error |
| Finding detection | Findings remain visible to the gate | 5 findings retained; no suppression or clean-scan claim | Same JSON/SARIF | PASS detected |
| Exit-code behavior | Findings or scanner errors fail the scan step | `--error` configured; JSON/SARIF statuses are checked and nonzero status exits the step | `workflow.yml`; validation JSON | PASS configured |
| JSON/SARIF export | Both machine-readable formats are produced | Both files exist in retained local run | `raw-results/semgrep/current-source-20261021-1639/` | PASS locally |
| Artifact upload | Results remain available after success/failure | SARIF and raw files uploaded successfully | `.github/workflows/semgrep.yml`; hosted baseline run 39607269350 | VERIFIED — BASELINE |
| GitHub Actions execution | A real hosted run is available | Baseline run 39607269350 completed with scan-step failure on five findings; remediation rerun is pending push | [Hosted run](https://github.com/Hon7374/BeautyCare/actions/runs/39607269350) | VERIFIED — BASELINE FAILED GATE |

The additional local rerun attempt is retained at `raw-results/semgrep-ci/20261021-1112/semgrep-rerun-attempt.log`; it exited 2 before scanning because Semgrep could not open the Windows certificate store (`CertOpenSystemStore returned NULL`). This environment issue does not replace the previously successful retained local scan and is not treated as a scanner finding.

## Academic result statement

*Static analysis was integrated as a reproducible CI workflow using the OWASP Top Ten ruleset, with explicit exclusion of secrets, dependencies, logs, and generated evidence. The hosted run on commit `46d7525` executed successfully through setup and upload, while the scan gate correctly failed on five findings. The result is reported as partial static-analysis coverage; no zero-vulnerability or passing-CI claim is made.*

## Remediation addendum — 2026-10-22

The baseline failure remains historical. Local revalidation of the prepared working tree using Semgrep 1.182.0 reports 0 findings and 0 errors over the same 42 source targets, but 4 fixpoint timeouts remain in the JSON timing metadata; the custom gate correctly fails with `INCOMPLETE_ANALYSIS`. Reports 29–34 contain the source diff and raw evidence. No new hosted run is claimed before user confirmation and push.

## Reproduction command

```powershell
$env:PYTHONUTF8='1'; $env:PYTHONIOENCODING='utf-8'
$sg="$env:TEMP/beautycare-iccIT-semgrep-venv/Scripts/semgrep.exe"
$common=@('scan','--config','p/owasp-top-ten','--metrics=off','--no-git-ignore',
  '--include','*.js','--exclude','node_modules','--exclude','.env*',
  '--exclude','logs','--exclude','raw-results','--exclude','results',
  '--exclude','coverage','--timeout','0','--timeout-threshold','0','backend')
& $sg @common '--json' '--output' 'current-source-20261021-1639/after.json'
& $sg @common '--sarif' '--output' 'current-source-20261021-1639/after.sarif'
```
