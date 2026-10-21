# SAST Before/After Experiment

Date: 2026-10-22 (Asia/Saigon)

## Controlled comparison

| Metric | Before: preserved run-396 source | After: local remediation |
|---|---:|---:|
| Semgrep version | 1.182.0 | 1.182.0 |
| Ruleset | `p/owasp-top-ten` | `p/owasp-top-ten` |
| Backend source targets | 42 | 42 |
| Findings | 5 | 0 |
| Scanner errors | 0 | 0 |
| Fixpoint timeouts | 4 | 4 |
| SARIF generated | yes | yes |
| Security gate | failed | failed closed: `INCOMPLETE_ANALYSIS` |

The after scan used the pinned version and the same explicit source target set, with `--no-git-ignore --timeout 0 --timeout-threshold 0 --error`; the Semgrep JSON/SARIF processes exited zero, but the JSON timing metadata retained four fixpoint timeouts. The new security gate correctly converted that incomplete analysis into exit 1. The before inputs are copied, not regenerated or overwritten, from `FINAL_VERIFIED_EVIDENCE_V2/raw-results/semgrep/current-source-20261021-1639/`.

## Test comparison

- Focused sanitizer/payment tests: 7/7.
- Smoke runner including the sanitizer and gate suites: 62/62.
- DB-backed payment/security suite on `beautycare_test`: 9/9.
- ESLint: pass.

## Interpretation

The result is consistent with a real source-level change: explicit HTML sanitization in the payment and auth HTML sinks, shared utility coverage, regression tests, and a fail-closed analysis gate. It is not a Semgrep suppression or a changed rule threshold. Timeout coverage remains partial; hosted CI is pending the user-approved push and must be recorded as a new experiment point when it runs.

