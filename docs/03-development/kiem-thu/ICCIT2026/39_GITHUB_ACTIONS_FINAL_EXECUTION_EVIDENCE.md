# GitHub Actions Final Execution Evidence

Date: 2026-10-22 (Asia/Saigon)

## 1. Source revision

| Field | Value |
|---|---|
| Repository | `https://github.com/Hon7374/BeautyCare` |
| Base commit | `761b46462cd2a0f8d44610b35ea60c0d4a6e3f7c` |
| Verification branch | `fix/semgrep-ci-final-verification` |
| Hosted commit | Pending branch push and pull-request execution |
| Source changes | Shared HTML sanitizer, fail-closed Semgrep gate, XSS regression tests, and Semgrep workflow worker serialization |

The working tree contains unrelated user changes and generated evidence files. Only the source, workflow, security gate, directly related tests, reproducibility MRE, and required reports are intended for the verification branch.

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

At report creation time, hosted execution is intentionally pending. No hosted run, URL, artifact identity, or conclusion is claimed until the branch is pushed and a pull request triggers `.github/workflows/semgrep.yml`. The historical run `39607269350` is not valid evidence for this source revision.

## 4. Local versus hosted comparison

| Metric | Local | GitHub Actions |
|---|---:|---:|
| Commit SHA | Pending branch commit | Pending hosted run |
| Semgrep version | 1.182.0 | Pending |
| Ruleset | `p/owasp-top-ten` | Pending |
| Targets | 42 | Pending |
| Rules | 70 | Pending |
| Findings | 0 | Pending |
| Scanner errors | 0 | Pending |
| Fixpoint timeouts | 0 | Pending |
| Gate | PASS, exit 0 | Pending |

These columns must be updated from GitHub’s actual job log and downloaded JSON/SARIF artifacts, not inferred from the local run.

## 5. Academic conclusion

The local evidence is sufficient to report reproducible source-state verification: the complete 42-target OWASP scan, fail-closed gate, regression tests, and database checks passed. Hosted CI execution, production security, and live-provider reliability remain separate claims and require their own evidence. After the pull-request run is collected, this report will be updated with the exact commit SHA, run ID, URL, job conclusion, gate result, and artifact names.

