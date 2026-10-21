# ICCIT 2026 — Final Evidence Provenance Audit

Date: 2026-10-21 (Asia/Saigon)

## V2 provenance boundary

V2 is rebuilt from the current synchronized reports and sanitized raw evidence. It records the final 70-test inventory, the 41-target post-expansion Semgrep scan alongside the preserved 42-target current-source scan, and the absence of B2 run 1. Historical packages remain unchanged; no raw evidence was overwritten.

## Audit conclusion

The new final evidence set is built from run-specific artifacts, source snapshots and reports whose provenance is recorded in `FINAL_VERIFIED_EVIDENCE`. Older packages are retained as historical inputs and are not silently promoted to the final set. No separately bundled raw-results archive exists; this absence is recorded rather than inferred away.

The workspace has no Git metadata, so source revision and commit identity are unavailable. The final set therefore uses file hashes, run IDs, commands, environment labels and explicit limitation notes as its provenance anchors.

## Historical ZIP comparison

The two existing archives were reopened into isolated temporary directories and compared at representative duplicate paths. Both archives are 549,394 bytes and their internal checksum files and selected raw artifacts are byte-identical.

| Compared artifact | ZIP A SHA-256 | ZIP B SHA-256 | Comparison |
|---|---|---|---|
| `raw-results/semgrep/current-source-20261021-1639-after.json` | `F2141FDBDE90B51BA4FDBC59FFC6DD7B33A7614CB7851E16C5BAFC447DA5BAA8` | same | IDENTICAL |
| `raw-results/vnpay-ipn/vnpay-ipn-20261021.json` | `20D30745AFC03145BA4DC5E6EA2904DD559997CA9739FC3C5A60E71D45002E68` | same | IDENTICAL |
| `raw-results/payment/vnpay-duplicate-callback-20261021.json` | `A9F3AC8393E9D82B08EF5A95FB451F320B2A8EA2F943BF847F1B854C30A87808` | same | IDENTICAL |
| `raw-results/security-test-coverage/test-all-20261021.console.log` | `9791E41974C9CD1ED830A6A2158C0A633432B269C2F30503DB0F4B03C6E69A36` | same | IDENTICAL |
| `integrity-checksums.sha256` | `201666BDBB235DB7318CE414AAFEED1A43CE026186595EFA52E54EAD2C154ABE` | same | IDENTICAL |

The two old ZIPs are therefore duplicate historical packages, not two independent replications. Their embedded manifest identifies a validation/interrupted performance context and must not be used as proof that a hosted CI run or a missing performance run occurred.

## Authoritative current-source artifacts

| Evidence | Primary artifact | Provenance/status |
|---|---|---|
| Security discovery | `raw-results/security-test-coverage/test-discovery-baseline-20261021.json` | Derived from 16 current test sources and executed JSON; 55 unique cases |
| Full regression | `raw-results/security-test-coverage/full-regression-20261021-1830/test-all-console.log` | `npm run test:all`; 9/41 smoke and 4/8 DB passed |
| Post-secret integration | `raw-results/security-test-coverage/full-regression-20261021-1830/integration/` | Current sources; out-of-band `VNPAY_TEST_SECRET`; no secret value stored |
| Payment atomicity | `raw-results/payment-atomicity/20261021-1115/` | Run-specific before/after snapshots, manifest and checksums; PASS |
| Current Semgrep | `raw-results/semgrep/current-source-20261021-1639/after.json` and `.sarif` | Semgrep 1.182.0; 42 targets; 70 rules; 5 findings; 0 errors; 4 fixpoint timeouts |
| Workflow validation | `raw-results/semgrep-ci/20261021-1112/` | YAML validation passed; hosted execution unavailable |

The earlier corrected 37-target Semgrep evidence and historical fixed-path VNPay files remain preserved as historical artifacts. They are not deleted, rewritten or used to hide provenance differences.

## Fixed-path and secret audit

The integration tests previously wrote to legacy fixed paths in earlier runs. Those outputs are actual historical test results but their timestamps and hashes differ from the current run-specific evidence; they are labeled historical. After the writer correction, artifacts are written only when `ICCIT_ARTIFACT_DIR` is explicitly supplied.

The two VNPay integration sources no longer contain a literal secret. The final package excludes `.env` files, database credentials, process environment dumps and the disposable secret value. Reports describe only the variable name and out-of-band setup requirement.

## Missing and partial evidence

| Item | Finding | Treatment |
|---|---|---|
| Separately bundled raw-results archive | Not present anywhere under the repository | Recorded as absent; no substitute invented |
| Booking B2 run1 | No `b2-final-run1` JSON, console or DB assertion found; only B2 run2/run3 exist | Report run2/run3 only; do not claim three B2 runs |
| Git commit/remote | No `.git` or remote metadata | Commit/SHA/URL marked unavailable |
| GitHub-hosted Semgrep run | No `gh`, repository identity or hosted logs | CI marked configured/local-validated, hosted execution not verified |
| Semgrep complete coverage | 4 fixpoint timeouts and 5 residual findings | SAST remains partial; no clean-scan claim |

## Final consistency controls

The final package contains an evidence index, a consistency report, run manifests, source snapshots, raw evidence and a SHA-256 checksum file. It is deliberately separate from the old `FINAL_EVIDENCE_PACKAGE` directory and old ZIPs. The package is reopened after compression, its internal checksums are recomputed, and a secret-pattern audit is performed before release.

## Academic provenance statement

The evidence supports bounded claims about the tested local implementation: security regression behavior, local MySQL payment idempotency/atomicity, booking contention invariants, and local Semgrep execution. It does not support claims of independent duplicate archives, live VNPay delivery reliability, complete static-analysis coverage, a missing B2 run1, or a GitHub-hosted execution that was not observed.
