# GitHub Security Gate Revalidation Plan and Local Check

Date: 2026-10-22 (Asia/Saigon)

## Workflow controls

`.github/workflows/semgrep.yml` now pins `semgrep/semgrep:1.182.0`. The original OWASP ruleset, backend scope, exclusions, JSON/SARIF generation, `--error` gate, SARIF upload, and raw artifact upload remain in place. Artifact retention is explicitly 14 days. The job keeps `contents: read` and `security-events: write`; it has no write permission for repository contents and no `continue-on-error` on the scan step.

The JSON and SARIF statuses are still both checked. The job exits non-zero if either scan fails, so a real finding or serialization failure remains visible as a security-gate failure.

## Local revalidation using the pinned version

The exact 42-file source scope was scanned with Semgrep 1.182.0 and the same OWASP configuration. Semgrep process results were `0 findings`, `0 errors`, JSON exit `0`, and SARIF exit `0`, but JSON timing metadata recorded 4 fixpoint timeouts. The custom gate therefore returned `INCOMPLETE_ANALYSIS` and exit 1. Lint passed; smoke passed 62/62 after adding gate tests; payment/security integration on `beautycare_test` passed 9/9.

## Hosted status

No new GitHub Actions run is claimed in this report because the remediation is intentionally unpushed pending user confirmation. Run `39607269350` remains the historical baseline and failed on the five old findings. The prepared workflow now also fails closed on incomplete analysis and uploads `semgrep-gate-summary.json`. After confirmation, push the prepared commit, wait for the new Semgrep run, and record its run ID, conclusion, artifact ID/digest, timeout count, and final JSON/SARIF counts here without overwriting the baseline evidence.

