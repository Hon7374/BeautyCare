# 400-VU JSON analysis

## Historical A as reported, not revalidated

The repository reports A as 400 VU for approximately 300 seconds, 1,244,906 requests/iterations, 91,742 HTTP 200 responses, and 1,153,164 failed/other requests. The reported failure rate is `1,153,164 / 1,244,906 = 0.9263060825`, or 92.63060825%. Reported total request throughput is approximately 4,149.372 requests/s; reported successful HTTP 200 throughput is approximately 305.784 responses/s. Because `results/k6-load-400vus.json` is absent, these values cannot be recalculated from raw JSON in this workspace.

## Current C raw JSON

| Metric | Value |
|---|---:|
| VUs / VUs max | 400 / 400 |
| `state.testRunDurationMs` | 300,292.85263 ms |
| Requests / iterations | 302,936 / 302,936 |
| HTTP 200 | 302,936 |
| HTTP failure rate | 0 |
| Request rate | 1,008.801899 req/s |
| Successful HTTP 200 rate | 1,008.801899 responses/s |
| `http_req_duration.avg` | 396.072391 ms |
| p90 / p95 / p99 | 433.582225 / 446.823768 / 478.190124 ms |
| Checks | 302,936 pass; 0 fail |

The equality of requests and iterations follows from the script's one-request iteration. Total request throughput equals successful-response throughput for C only because every recorded request received HTTP 200; neither metric is business-transaction throughput. The workload is only public service listing, not booking, payment, voucher, membership, or CSRF activity.

The current 500-VU aborted summary is separate evidence: 6,442 requests, 3,627 HTTP 200, 43.697609% failed, 2,815 failed checks, and 6.530285 seconds of recorded duration. It must not be merged with A, B, or C.
