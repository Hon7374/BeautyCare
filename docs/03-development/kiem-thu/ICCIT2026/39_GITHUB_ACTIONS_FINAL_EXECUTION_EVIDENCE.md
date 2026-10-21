# GitHub Actions Final Execution Evidence

Date: 2026-10-22 (Asia/Saigon)

## 1. Source revision

| Field | Value |
|---|---|
| Repository | `https://github.com/Hon7374/BeautyCare` |
| Base commit | `761b46462cd2a0f8d44610b35ea60c0d4a6e3f7c` |
| Verification branch | `fix/semgrep-ci-final-verification` |
| Hosted commit | `1c7a6a67645e15142b0fa2933316f6f68c5adc5a` |
| Pull request | `https://github.com/Hon7374/BeautyCare/pull/1` |
| Source changes | Shared HTML sanitizer, fail-closed Semgrep gate, XSS regression tests, and Semgrep workflow worker serialization |

Only the source, workflow, security gate, directly related tests, reproducibility MRE, and required reports were committed to the verification branch. The unrelated `README.md` working-tree change and generated root artifacts were not staged or pushed.

## 2. Local verification before push

The final local run is recorded under `raw-results/semgrep-remediation/20261022/final-ci-verification/`:

| Metric | Local result |
|---|---:|
| Semgrep | 1.182.0 |
| Ruleset | `p/owasp-top-ten` |
| Targets | 42/42 |
| Rules run | 70 |
| Findings | 0 |
| Scanner errors | 0 |
| Skipped rules | 0 |
| Fixpoint timeouts | 0 |
| Security gate | PASS, exit 0 |
| Gate regression | 14/14 |
| Focused security/XSS | 7/7 |
| Smoke | 68/68 |
| Database integration | 9/9 across 4 suites |
| ESLint | PASS |

The database run used a process-only test secret; no secret value was written to source, metadata, or logs. The first no-secret attempt is retained as a blocked-environment diagnostic; the successful rerun is `database-tests-with-test-secret.json`.

## 3. GitHub Actions execution

| Field | Hosted result |
|---|---|
| Workflow | `Semgrep security scan` |
| Event | `pull_request` |
| Run | `39694608906` |
| URL | `https://github.com/Hon7374/BeautyCare/actions/runs/39694608906` |
| Head SHA | `1c7a6a67645e15142b0fa2933316f6f68c5adc5a` |
| Job | `Semgrep OWASP scan` / `119548832344` |
| Conclusion | `success` |
| Security gate | `PASS`, exit 0 |
| Artifact | `semgrep-results`, ID `12389249672` |
| Artifact digest | `sha256:ebd9dcebd98a1c37fa9cc3601bb2fcc5d7d0a3070783d35fcd1f259d0c77c63a` |

The job steps for checkout, Semgrep scan, SARIF upload, and raw-result upload all completed successfully. The historical run `39607269350` remains a separate pre-fix failure and is not used as evidence for this source revision.

## 4. Local versus hosted comparison

| Metric | Local | GitHub Actions |
|---|---:|---:|
| Commit SHA | `1c7a6a67645e15142b0fa2933316f6f68c5adc5a` | `1c7a6a67645e15142b0fa2933316f6f68c5adc5a` |
| Semgrep version | 1.182.0 | 1.182.0 |
| Ruleset | `p/owasp-top-ten` | `p/owasp-top-ten` |
| Targets | 42 | 42 |
| Rules | 70 | 70 |
| Findings | 0 | 0 |
| Scanner errors | 0 | 0 |
| Skipped rules | 0 | 0 |
| Fixpoint timeouts | 0 | 0 |
| Gate | PASS, exit 0 | PASS, exit 0 |
| SARIF results | 0 | 0 |

The normalized target sets are equal: 42 local targets and 42 hosted targets, with no missing or unexpected path. The local and hosted SARIF files are byte-identical. The JSON files are semantically equivalent for scan outcome and gate metrics but have different byte hashes because runtime/provenance fields differ; this is recorded in `hosted-run-39694608906/local-hosted-comparison.json` rather than incorrectly claiming byte identity.

## 5. Hosted artifact paths

The downloaded artifact and API/job metadata are preserved under:

`raw-results/semgrep-remediation/20261022/hosted-run-39694608906/`

It contains the hosted JSON, SARIF, expected target list, invocation metadata, gate summary, hosted run metadata, hosted job metadata, artifact API response, and job log. The corresponding fresh local evidence is under:

`raw-results/semgrep-remediation/20261022/final-ci-verification/`

The comparison file records `target_set_equal: true`, `local_gate_status: PASS`, `hosted_gate_status: PASS`, `sarif_byte_hash_equal: true`, and `json_byte_hash_equal: false`.

## 6. Academic conclusion

The evidence supports a bounded claim: the BeautyCare backend's complete 42-target OWASP scan, using Semgrep 1.182.0 and the fail-closed serial-worker configuration, produced no findings, scanner errors, skipped rules, or fixpoint timeouts in both local and hosted execution. The hosted PR job and evidence artifact are independently verified for the exact source commit above. This does not prove zero vulnerabilities, production security, live-provider reliability, or distributed-system behavior.

Historical findings and timeout-bearing artifacts remain preserved and clearly labeled; no finding was suppressed and no target was removed to obtain the current result.
