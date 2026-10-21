# Semgrep Timeout Final Resolution

Date: 2026-10-22T01:50:30+07:00 (Asia/Saigon)

## Revision and scope

- Repository: `Hon7374/BeautyCare`
- Base commit: `761b46462cd2a0f8d44610b35ea60c0d4a6e3f7c`
- Current source revision: uncommitted working tree based on that commit; no new commit exists yet.
- Semgrep: `1.182.0` (pinned local/CI version)
- Comparison engine: `1.181.0`
- Ruleset: `p/owasp-top-ten`
- Scope: the same 42 backend JavaScript source targets, excluding tests as in the preserved baseline scope.
- Command: `semgrep scan --config p/owasp-top-ten --no-git-ignore --timeout 0 --timeout-threshold 0 --error --json ...`.

## Raw JSON result

The latest after-scan JSON is `raw-results/semgrep-remediation/20261022/semgrep/after-final/semgrep.json`. It contains:

| Metric | Value |
|---|---:|
| Scanned targets | 42 |
| Findings | 0 |
| `errors` | 0 |
| `time.fixpoint_timeouts` | 4 |
| Timeout files | `admin.js`, `auth.js`, `bookings.js`, `payments.js` |

The four entries are warnings inside the `time` metadata, not scanner errors. The new `check-semgrep-result.py` gate reads that exact field and returns `INCOMPLETE_ANALYSIS` with exit code 1. Missing or malformed timeout metadata also fails closed as `INCONCLUSIVE`.

## Isolation matrix

| File | Full-scan timeout | Isolated file timeout | Relevant rule evidence | Resolution |
|---|---:|---:|---|---|
| `admin.js` | yes | no | `raw-html-format` timeout in the 4-file rule isolation | Retain partial coverage; do not suppress. |
| `auth.js` | yes | no | `raw-html-format` and `x-frame-options` isolated groups timeout; redirect/SSRF groups complete | Retain partial coverage; do not suppress. |
| `bookings.js` | yes | no | Full scan reports raw-HTML as first rule; no single-file timeout | Retain partial coverage; do not suppress. |
| `payments.js` | yes | no | Full scan reports open-redirect as first rule; isolated relevant groups complete | Retain partial coverage; do not suppress. |

The per-file scans all returned 0 findings, 0 scanner errors, and 0 timeouts. Grouped/full scans reproduced the issue, and the first rule changed with target/rule grouping. This points to a multi-file taint/fixpoint interaction rather than one deterministic source sink. The 1.181.0 full scan reproduced 4 timeouts with the same 42 targets and ruleset, so changing only the engine version did not resolve it.

## Security decision

The five raw-HTML findings are fixed and regression-tested. The four timeout coverage gaps are not resolved; the correct status is `PARTIAL COVERAGE`, not “0 timeout”. The workflow now preserves artifacts and fails the security gate for incomplete analysis. No security logic, authorization, CSRF, payment finalization, or transaction atomicity was removed to make analysis faster.

Evidence: `raw-results/semgrep-remediation/20261022/analysis/` contains the full JSON/gate summary, engine comparison, per-file runs, and isolated-rule runs.

## Scope-hardening and minimal reproduction update

The gate now compares `paths.scanned` against a runtime-generated expected scope and rejects empty scans, missing targets, unexpected targets, invalid metadata and ruleset mismatch. The latest scope-hardening scan still reports 42/42 targets, 0 findings, 0 scanner errors, 0 skipped rules and 4 fixpoint timeouts; the hardened gate returns `INCOMPLETE_ANALYSIS`, exit 1.

Six pairwise, four triple and progressive-prefix experiments identify `admin.js + auth.js` as the smallest target-level reproduction. Single-file controls complete without timeout. The reproducibility package is under `semgrep-timeout-mre/`; no smaller line-level synthetic case is claimed.

