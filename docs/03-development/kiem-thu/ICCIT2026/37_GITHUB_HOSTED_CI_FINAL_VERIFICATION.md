# GitHub Hosted CI Final Verification

Date: 2026-10-22 (Asia/Saigon)

## Local source and workflow state

- Repository: `Hon7374/BeautyCare`
- Branch: `main`
- Base commit: `761b46462cd2a0f8d44610b35ea60c0d4a6e3f7c`
- Current source: uncommitted working tree based on that commit
- Workflow: `.github/workflows/semgrep.yml`
- Semgrep image: `semgrep/semgrep:1.182.0`
- Ruleset: `p/owasp-top-ten`
- GitHub push: not performed

The workflow now generates its expected JavaScript scope from the checked-out source, passes the exact list to Semgrep JSON/SARIF scans, validates scope/configuration metadata, uploads JSON/SARIF/gate/scope artifacts with `if: always()`, and propagates all scan and gate exit statuses. It does not use `continue-on-error` or `|| true` to hide incomplete analysis.

## Hosted execution status

`NOT VERIFIED`: no post-fix commit, hosted run, run URL, job conclusion or artifact digest exists yet. Historical run `39607269350` remains evidence for the pre-fix source only and is not used to claim verification of this working tree.

## Local verification

| Check | Result |
|---|---:|
| Security gate regression suite | 14/14 passed |
| Smoke suites/tests | 13 suites, 68/68 passed |
| Focused payment/sanitizer tests | 7/7 passed |
| Database security tests | 4 suites, 9/9 passed |
| ESLint | passed |
| Syntax and `git diff --check` | passed |
| Original OWASP Semgrep | 42 targets, 0 findings, 0 errors, 4 timeouts |
| Hardened gate | `INCOMPLETE_ANALYSIS`, exit 1 |

## Static Analysis Coverage and Reproducibility

The original configuration uses the OWASP Top Ten registry ruleset with Semgrep OSS `1.182.0`, explicit JavaScript target enumeration under `backend`, and timeout flags set to zero for the diagnostic runs. The five historical HTML findings were remediated with a shared sanitizer and regression tests. The post-fix scan reports zero findings and zero scanner errors, but its `time.fixpoint_timeouts` metadata contains four entries. The fail-closed gate consequently rejects the result as incomplete rather than treating zero findings as complete coverage.

The timeout investigation used full-scope, single-file, pairwise, triple, progressive-prefix, isolated-rule and engine-comparison experiments. The smallest faithful reproduction found is the two-target `admin.js`/`auth.js` group under the original OWASP ruleset. This supports a target-set-dependent taint/fixpoint interaction, while the internal engine convergence mechanism remains a threat to validity rather than a proven implementation defect. Semgrep `1.181.0` also reproduced four full-scope timeouts, so changing only the engine version was not a demonstrated fix.

The evidence is reproducible locally from the raw JSON, SARIF, expected-scope list, invocation metadata, MRE, Docker digest, test logs and manifests. Hosted CI remains pending an approved push. Therefore the paper-ready conclusion is **partial static-analysis coverage with explicit residual timeout evidence**, not complete coverage and not a zero-vulnerability claim.

