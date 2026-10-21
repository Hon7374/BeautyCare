# V2 Evidence Consistency Report

## Cross-checks

| Check | Result |
|---|---|
| Test discovery | 55 baseline + 15 additions = 70 unique |
| Smoke | 51/51 passed |
| Focused completion | 36/36 passed |
| DB-backed | 9/9 passed |
| Booking DB | 3/3 passed |
| Lint and syntax | pass; 18 test files |
| Semgrep current-source | 42 targets, 70 rules, 5 findings, 0 errors, 4 timeouts |
| Semgrep post-expansion | 41 targets, 70 rules, 5 findings, 0 errors, 4 timeouts |
| GitHub hosted CI | VERIFIED — run 39606730459; FAILED SECURITY GATE |
| B2 run 1 | absent; not inferred |
| Secret/PII audit | no literal production/test secret or personal-data export in package |

Phase totals are intentionally separate and are not added as if they were one Jest invocation. The five Semgrep findings are retained without suppression, and the four timeouts remain visible. Hosted run 39606730459 executed on commit 46d7525, failed at the Semgrep gate, and uploaded SARIF/raw artifacts. B2 JSON setup credentials are redacted in this package; the original raw evidence remains outside the package unchanged.
