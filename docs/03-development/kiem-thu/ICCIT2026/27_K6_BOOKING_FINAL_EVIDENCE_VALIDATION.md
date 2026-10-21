# k6 Booking Final Evidence Validation

## B2 run-1 status

**HISTORICAL / INSUFFICIENT RAW EVIDENCE**

No B2 run-1 JSON, console log, or database assertion was found in the current workspace, the V1 evidence package, or the preserved historical ZIPs. It is not recreated, inferred, or presented as a verified run.

## Verified B2 evidence

The available raw runs are B2 run 2 and run 3:

| Run | Iterations | Booking success | Rejected | Unexpected | Auth failures | Booking p95 (ms) | Booking p99 (ms) | DB max/slot | Violation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| B2 run 2 | 19,493 | 19,493 | 0 | 0 | 0 | 55 | 80 | 1 | false |
| B2 run 3 | 19,485 | 19,485 | 0 | 0 | 0 | 56 | 79 | 1 | false |

Raw k6 JSON files are `raw-results/k6-booking/k6-booking-b2-b2-final-run2.json` and `k6-booking-b2-b2-final-run3.json`; database assertions are the corresponding `b2-final-run2-db-assertion.json` and `b2-final-run3-db-assertion.json`.

## Metric interpretation

`booking_duration` is the booking-request trend and is the appropriate booking latency metric. `http_req_duration` is a transport-level aggregate and must not be described as booking-only; the script performs authenticated setup/login requests and booking requests. The raw JSON also retains setup material, so it is not copied into the sanitized final package without redaction.

The B2 evidence demonstrates the tested local workload's no-overbooking invariant and successful booking requests for runs 2 and 3. It does not establish a three-run B2 replication, global throughput, live deployment capacity, or production readiness.
