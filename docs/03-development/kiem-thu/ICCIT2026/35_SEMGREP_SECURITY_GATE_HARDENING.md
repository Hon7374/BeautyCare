# Semgrep Security Gate Hardening

Date: 2026-10-22 (Asia/Saigon)

## Implemented policy

`backend/scripts/check-semgrep-result.py` is now a fail-closed Semgrep JSON gate (`semgrep-json-gate/v2`). It requires valid JSON, a valid Semgrep version, object arrays for `results`, `errors`, `skipped_rules`, and `time.fixpoint_timeouts`, and a string array in `paths.scanned`.

The workflow no longer relies on a hardcoded target count. It dynamically enumerates tracked-scope JavaScript targets under `backend`, records the generated expected scope, and passes the exact target list to both JSON and SARIF scans. Explicit exclusions are recorded in `semgrep-invocation.json`: tests, dependencies, documentation, logs, outbox, results, coverage and the local test runtime. The gate compares the normalized set of `paths.scanned` with that generated scope and rejects empty scans, missing targets and unexpected targets.

The gate also validates invocation metadata and requires the expected `p/owasp-top-ten` ruleset. Missing or malformed JSON/configuration is `INCONCLUSIVE`; empty scan is `EMPTY_SCAN`; scope mismatch is `INCOMPLETE_SCOPE`; findings, scanner errors or skipped rules are `FAIL`; fixpoint timeouts are `INCOMPLETE_ANALYSIS`; only complete clean evidence is `PASS`. Every non-PASS state exits non-zero.

## Regression evidence

The gate regression suite has **14/14 tests passed**, covering:

- clean complete scan;
- findings, scanner errors and fixpoint timeouts;
- empty `paths.scanned`;
- missing expected target;
- legitimate exclusions;
- newly added JavaScript target after scope regeneration;
- invalid field types and skipped-rule metadata;
- missing/malformed JSON and timeout metadata;
- ruleset configuration mismatch.

The latest raw after-scan was rechecked with the hardened gate:

| Metric | Result |
|---|---:|
| Expected targets | 42 |
| Scanned targets | 42 |
| Findings | 0 |
| Scanner errors | 0 |
| Skipped rules | 0 |
| Fixpoint timeouts | 4 |
| Gate | `INCOMPLETE_ANALYSIS`, exit 1 |

The scan is therefore not presented as a clean pass. Raw JSON, gate summary, expected target list and invocation metadata are under `raw-results/semgrep-remediation/20261022/`.

