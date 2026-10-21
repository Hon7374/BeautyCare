# Evidence-to-claim mapping

| Paper claim | Classification | Evidence / correction |
|---|---|---|
| 9 suites, 41 passed | VERIFIED BY EXISTING EVIDENCE | `docs/EXPERIMENT_RESULTS.md:11-18` and `backend/logs/test-all-20260820-222114.log`; historical only |
| 5/5 isolated MySQL-backed tests | VERIFIED BY EXISTING EVIDENCE | `docs/EXPERIMENT_RESULTS.md:20-25`; historical only |
| 19/19 security regression tests | VERIFIED BY EXISTING EVIDENCE | `docs/EXPERIMENT_RESULTS.md:102-108`; historical only |
| 100/200/300 VU completed 5m with 0% HTTP errors | VERIFIED BY EXISTING EVIDENCE | `docs/EXPERIMENT_RESULTS.md:65-77` and three k6 JSON files |
| 400 VU passed 5m | CONTRADICTED | Retained JSON has 92.631% failure rate; report as overload/failed observation |
| 500 VU passed 5m | CONTRADICTED | Retained JSON is 14.8s partial with 14.761% failure rate |
| CSRF is signed and session-bound | CONTRADICTED | Source supports naive double-submit only |
| 11 VNPay sandbox records: 10 paid, 1 failed | VERIFIED BY EXISTING EVIDENCE | `results/vnpay-sandbox/transaction-summary.json/.md`; this audit did not rerun sandbox |
| OWASP ZAP High 0, Medium 4, Low 2, Informational 3 | VERIFIED BY EXISTING EVIDENCE | `results/zap-final/zap-final.json`; not a clean scan claim |
| Discount edge-case suite passes | NOT VERIFIED | No retained execution evidence; several requested rules are not implemented |

