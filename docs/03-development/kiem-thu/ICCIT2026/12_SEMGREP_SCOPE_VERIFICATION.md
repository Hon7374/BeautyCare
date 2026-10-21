# Semgrep Scope and Timeout Verification

Date: 2026-10-21 (Asia/Saigon)

## Discrepancy in the earlier artifact

The original `before.json` and `after.json` each contain three `.env*` entries in `paths.scanned`: `.env.backup_before_mysql_port_update_20260614`, `.env.example`, and `.env.production.example`. The original rule findings were all in `backend/routes/payments.js`, and the JSON does not contain source contents or secret values, but the discovery listing does not satisfy the requested strict exclusion claim. The old artifacts are retained as baseline evidence and were not edited.

`paths.scanned` is a discovery/reporting field and must not automatically be interpreted as proof that every listed file reached JavaScript rule execution. To remove ambiguity, the corrected scan used Semgrep's target-listing mode and a stricter path-independent exclusion set. It reported `.env*`, `node_modules`, `logs`, `tests`, and the MySQL runtime directory as ignored; 37 JavaScript files were selected.

The `.env` and backup files are treated as sensitive configuration. Their values are not reproduced in this report or in Semgrep logs. The corrected scan did not select them.

## Corrected scope command

```powershell
$sg = "$env:TEMP\beautycare-iccIT-semgrep-venv\Scripts\semgrep.exe"
$env:PYTHONUTF8 = '1'
$common = @(
  'scan','--config','p/owasp-top-ten','--metrics=off','--no-git-ignore',
  '--include','*.js','--exclude','node_modules','--exclude','.env*',
  '--exclude','logs','--exclude','tests','--exclude','.runtime-test-mysql',
  '--timeout','0','--timeout-threshold','0','backend'
)
& $sg @($common[0..($common.Count-2)] + @('--json','--output',
  'docs/03-development/kiem-thu/ICCIT2026/raw-results/semgrep-scope-verification/scope-timeout0.json',
  $common[-1]))
& $sg @($common[0..($common.Count-2)] + @('--sarif','--output',
  'docs/03-development/kiem-thu/ICCIT2026/raw-results/semgrep-scope-verification/scope-timeout0.sarif',
  $common[-1]))
```

The target-listing verification used the same include/exclude options with `--x-ls-long`; it selected 37 `.js` files and explicitly marked the `.env*` files as `cli_exclude_flags_match`. The `--x-*` option is diagnostic-only and is not part of the production scan command.

## Corrected scan result

The corrected JSON reports Semgrep 1.182.0, 37 targets, 70 rules, 5 findings, and 0 parser/runner errors. SARIF contains one run and 5 results. The five findings remain the same payment-route XSS rule and locations after remediation; no new finding was suppressed.

The corrected run with `--timeout 30` produced 4 fixpoint timeouts. A second run with `--timeout 0` reduced this to 3 fixpoint timeouts, but did not eliminate them:

| File | Remaining timeout context |
|---|---|
| `backend/routes/admin.js` | taint analysis; first rule `raw-html-format` |
| `backend/routes/auth.js` | taint analysis; first rule `express-open-redirect` |
| `backend/routes/payments.js` | taint analysis; first rule `x-frame-options-misconfiguration` |

The earlier baseline had 5 timeout records before remediation and 4 after remediation. Therefore, `errors=0` means no fatal scan/serialization error; it does not prove that all taint analyses completed. The evidence status is **scope verified for the 37 selected JavaScript targets, with partial rule coverage due to 3 residual fixpoint timeouts**.

## Raw outputs

- Corrected scope JSON: `raw-results/semgrep-scope-verification/scope.json`.
- Corrected scope SARIF: `raw-results/semgrep-scope-verification/scope.sarif`.
- Timeout-zero JSON: `raw-results/semgrep-scope-verification/scope-timeout0.json`.
- Timeout-zero SARIF: `raw-results/semgrep-scope-verification/scope-timeout0.sarif`.
- Target-listing and custom sanitizer evidence: `raw-results/semgrep-scope-verification/fixtures/`.

No baseline JSON/SARIF was overwritten.

## Current rerun correction

The reproducible scope command now also excludes `run-vnpay-integration.js`, which is a test harness rather than production backend source. The successful run selected 37 JavaScript files, zero `.env*` paths, and produced 5 findings, 0 errors, and 3 fixpoint timeouts. The three timeout contexts were `admin.js`/`raw-html-format`, `auth.js`/`express-open-redirect`, and `payments.js`/`x-frame-options-misconfiguration`.

Current raw files are `raw-results/semgrep/rerun-final-20261021-100247/scope-timeout0.json` and `scope-timeout0.sarif`. The failed `**/.env*` glob attempt is recorded in `07_SAST_SECURITY_SCAN.md` and is not used as evidence. No baseline JSON/SARIF was overwritten.

The final source-state scan is preserved separately at `raw-results/semgrep/final-rerun-20261021-144721/after.json` and `after.sarif`. It retained 37 selected targets and 5 findings, with 5 fixpoint timeout records; this is the authoritative current-source result.
