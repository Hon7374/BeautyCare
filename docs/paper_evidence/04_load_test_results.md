# Load-test results

All rows are **historical evidence** from retained k6 JSON files and `docs/EXPERIMENT_RESULTS.md`; no new load run was performed on 2026-10-17.

| VU | Duration | Requests | RPS | Avg ms | p90 | p95 | p99 | HTTP error rate | Status |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 100 | 5m | 294,163 | 980.340 | 101.835 | 114.566 | 121.185 | 141.725 | 0% | PASS (historical) |
| 200 | 5m | 287,191 | 956.814 | 208.797 | 227.903 | 236.883 | 251.423 | 0% | PASS (historical) |
| 300 | 5m | 286,276 | 953.492 | 314.271 | 340.442 | 353.194 | 375.449 | 0% | PASS (historical) |
| 400 | artifact reports ~5m | 1,244,906 | 4,149.372 | 35.480 | unavailable/invalid for failure-heavy run | 463.984 | 503.561 | 92.631% | FAIL/overload observation |
| 500 | 14.8s | 12,425 | 838.560 | 576.463 | 723.404 | 736.878 | 937.874 | 14.761% | STOPPED overload observation |

The 400-VU JSON exists (`results/k6-load-400vus.json`) and shows 92.631% failed requests, so it cannot be treated as a successful five-minute capacity result. This conflicts with the historical prose saying no finalized 400-VU JSON was produced. The conflict is preserved, not resolved by choosing the more favorable account. The 500-VU run is explicitly partial. No 400/500 capacity pass is claimed.

The script calls only `GET /api/services`; it does not test request mix, authenticated sessions, CSRF, vouchers, membership, or payments. The completed 100/200/300 results support only the stated local endpoint benchmark under the recorded conditions.

