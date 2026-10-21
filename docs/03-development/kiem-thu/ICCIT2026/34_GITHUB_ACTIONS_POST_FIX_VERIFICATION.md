# GitHub Actions Post-Fix Verification

Date: 2026-10-22 (Asia/Saigon)

## Workflow change

`.github/workflows/semgrep.yml` now uses `semgrep/semgrep:1.182.0`, preserves the original OWASP scan, checks both JSON and SARIF process status, and runs `backend/scripts/check-semgrep-result.py` against the JSON. The gate policy is:

- findings: fail;
- scanner errors: fail;
- `time.fixpoint_timeouts` > 0: `INCOMPLETE_ANALYSIS`, fail;
- missing/malformed JSON or timeout metadata: `INCONCLUSIVE`, fail;
- only complete clean JSON passes.

SARIF, JSON, gate summary, and raw logs remain uploaded with `if: always()`; no `continue-on-error` or `|| true` is used to hide a failure.

## Local verification

- Gate fixtures: 8/8 tests pass.
- Smoke runner: 13 suites, 62/62 tests pass.
- ESLint: pass.
- Payment/security integration on isolated `beautycare_test`: 4 suites, 9/9 tests pass.
- Latest Semgrep JSON: 42 targets, 0 findings, 0 scanner errors, 4 fixpoint timeouts.
- Gate result for that JSON: `INCOMPLETE_ANALYSIS`, exit 1.

## Hosted GitHub Actions status

`NOT VERIFIED` for the post-fix source. No push was performed in this turn, so there is no new hosted run URL, run ID, commit SHA, job conclusion, security-gate conclusion, or hosted artifact digest to report. Run `39607269350` is historical and must not be used as evidence for the current uncommitted source.

After user approval and push, record the new run URL/ID, exact commit SHA, workflow conclusion, Semgrep findings/errors/timeouts, gate summary, SARIF upload, and artifact ID/digest in a new evidence directory. A hosted run that fails with `INCOMPLETE_ANALYSIS` would be an expected security-gate result, not a reason to weaken the policy.

## Final scope-hardening update

The workflow now generates an expected JavaScript target list from the checked-out `backend` source and passes that exact list to both scan modes. The gate validates scope equality, non-empty scan coverage, Semgrep version, skipped-rule metadata and an invocation metadata file containing the expected `p/owasp-top-ten` ruleset. The gate regression suite is now 14/14 passed.

The latest original-rule scan remains 42 targets, 0 findings, 0 scanner errors, 0 skipped rules and 4 `time.fixpoint_timeouts`; gate outcome remains `INCOMPLETE_ANALYSIS`, exit 1. Local smoke is 13 suites/68 tests passed. Hosted post-fix status remains `NOT VERIFIED` because no push was performed.

