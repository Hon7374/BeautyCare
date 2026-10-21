# Security Regression Results

## Current executable results

| Check | Command | Result | Classification |
|---|---|---|---|
| JavaScript syntax | `node --check` on modified backend files | Exit 0 | Verified |
| ESLint | `npm run lint` | Exit 0 | Verified |
| Smoke/security regression | `npm run test:smoke` | 9 suites, 41 tests passed | Verified |
| Focused CSRF/payment/pricing/XSS | `npx jest --runInBand ...` | 4 suites, 29 tests passed | Verified |
| DB authentication lifecycle and VNPay callback | `npm run test:db` | 2 suites, 6 tests passed | Verified |
| DB booking concurrency | `jest --runInBand tests/booking-concurrency.integration.test.js` | 1 test passed: 3/47 and count 3 | Verified |
| Isolated full suite | `DB_NAME=beautycare_test npm run test:all` | Final smoke 51/51 plus DB suites 9/9; 70 unique inventory | Verified locally |
| Semgrep | Semgrep 1.182.0 with `p/owasp-top-ten` | 5 findings before and 5 residual tool findings after; JSON/SARIF retained | Partial/manual review |

The smoke suite still emits expected warnings from fallback test fixtures (for example, unavailable local DB for a plans fallback); these did not fail the suite.

## Historical evidence kept separate

Earlier documents contain retained historical test counts and VNPay-related rows. They remain separate from this rerun and must not be interpreted as live-provider payment evidence.

## Security conclusion

The no-DB and isolated-DB regression sets are green. The VNPay callback integration now verifies one finalization under sequential and 50-request concurrent duplicate delivery in real isolated MySQL. Semgrep executed successfully and the reflected-HTML finding was remediated, but five residual tool findings and three corrected-scope fixpoint timeouts remain for manual/coverage review. Live provider duplicate delivery remains an external-behavior limitation.

The 2026-10-21 rerun is the current count: smoke 9 suites/41 tests and DB 2 suites/6 tests. These counts are not added to earlier retained totals.

The final route-verification patch was followed by the same result: lint exit 0, smoke 9 suites/41 tests, and isolated DB 2 suites/6 tests. The additional valid-signature amount-mismatch assertion passed.
