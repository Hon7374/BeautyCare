# Semgrep Timeout Minimal Reproduction

Date: 2026-10-22 (Asia/Saigon)

## Minimum target-level reproduction

The smallest reproducing target group found is:

`backend/routes/admin.js` + `backend/routes/auth.js`

Using Semgrep `1.182.0`, Docker digest `sha256:4a34048c04fef049f71665047f074cffb00cc3d89482f965a5cd151d589237af`, the original `p/owasp-top-ten` ruleset and `--timeout 0 --timeout-threshold 0` produces 0 findings, 0 scanner errors and 2 `time.fixpoint_timeouts`. Scanning either file alone produces 0 findings, 0 errors and 0 timeouts.

The six pairwise experiments and four triple experiments are preserved in `raw-results/semgrep-remediation/20261022/analysis/pairwise/` and `analysis/triples/`. The pairwise results show timeouts only for groups containing `auth.js` in this diagnostic run; the triple results show that `admin.js + auth.js` is sufficient. Progressive prefixes of the exact 42-target list were also tested: prefixes 1–7 completed, and prefix 8 reproduced the timeout when `auth.js` was added after `admin.js`.

The MRE is stored in `semgrep-timeout-mre/`. It contains copied production source for the two targets, the reproduction command, pinned engine metadata, the raw JSON and console log, and an isolated `raw-html-format` rule snapshot. The isolated rule on the pair did not timeout, so the evidence supports a multi-target interaction across the original OWASP rule set rather than a claim that one individual rule is solely responsible.

## Root-cause boundary

**Observed:** the condition is absent in single-file scans, appears with the two-file target group, and appears under the original OWASP ruleset; the same source/rule set also produces four timeout records in the full 42-target run.

**Verified root cause at the available evidence level:** target-set-dependent taint/fixpoint interaction.

**Not proven:** the internal convergence mechanism, a specific engine defect, or a unique rule implementation as the sole cause. Semgrep JSON does not expose enough internal state to prove those claims.

No production business logic was removed or refactored solely to make this diagnostic pass. The accepted state remains `PARTIAL STATIC ANALYSIS COVERAGE`, with the security gate failing incomplete analysis.

