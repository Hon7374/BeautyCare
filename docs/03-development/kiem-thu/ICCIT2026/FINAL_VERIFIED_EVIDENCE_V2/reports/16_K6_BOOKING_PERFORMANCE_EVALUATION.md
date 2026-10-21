# ICCIT 2026 — Stateful Booking Performance Evaluation

**Execution date:** 2026-10-21 (Asia/Saigon)  
**Environment:** Windows host, Docker MySQL 8.4 (`beautycare-mysql-app`, host port 3310), isolated database `beautycare_test`, backend on `http://127.0.0.1:3010`  
**Commit:** `COMMIT HASH UNAVAILABLE` (the workspace has no Git metadata)

## Scope and workload design

This experiment measures authenticated booking behavior against the real local MySQL database. It is separate from the historical public-read 100/200/300 VU replication and from the retained 400/500 VU artifacts.

| Workload | Configuration | Business invariant |
|---|---|---|
| B1 — same-slot contention | 50 VUs, one iteration per VU, same service/date/time | At most capacity 3 bookings are accepted; the remainder are rejected by the booking conflict path |
| B2 — sustained dynamic booking | 10 VUs ramping to 50 over 2 minutes, 50 VUs for 5 minutes, 50→0 over 1 minute | Each successful request uses an isolated future date/time slot; no slot exceeds capacity |

The workload source is `performance/k6-booking.js`. Setup authenticates 50 real test users and sends the resulting bearer/cookie/CSRF context with each booking request. The test data are prefixed and isolated to the test database; `.env`, user secrets and production data are outside the experiment.

## B1 results

The three final repetitions were executed independently. Values below are copied from the raw k6 JSON files; the database columns are copied from the corresponding post-run assertion files.

| Run | Iterations | Success | Rejected | Unexpected | HTTP failures | Req/s | Avg | p50 | p90 | p95 | p99 | DB total | DB max/slot | Capacity violation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| b1-final-run1 | 50 | 3 | 47 | 0 | 0 | 13.3242 | 196.164 ms | 158.203 ms | 349.690 ms | 369.872 ms | 386.004 ms | 3 | 3 | false |
| b1-final-run2 | 50 | 3 | 47 | 0 | 0 | 13.3195 | 181.032 ms | 160.204 ms | 267.931 ms | 280.876 ms | 293.980 ms | 3 | 3 | false |
| b1-final-run3 | 50 | 3 | 47 | 0 | 0 | 13.4688 | 176.381 ms | 152.264 ms | 273.492 ms | 287.267 ms | 298.325 ms | 3 | 3 | false |

The B1 result is therefore 9 accepted bookings and 141 expected contention rejections across three repetitions, with every database assertion ending at exactly three bookings for the contended slot. The expected 409-style business rejection is not counted as an HTTP transport failure.

## B2 results

B2 run 1 is absent from the current workspace, V1 package, and historical ZIPs. It is not recreated or inferred. Only runs 2 and 3 below are raw-verified.

| Run | Iterations | Success | Rejected | Unexpected | Auth failures | HTTP failures | Req/s | Avg | p50 | p90 | p95 | p99 | DB total | Unique slots | Max/slot | Capacity violation |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| b2-final-run2 | 19,493 | 19,493 | 0 | 0 | 0 | 0 | 40.0875 | 30.289 ms | 26.325 ms | 45.922 ms | 56.145 ms | 83.501 ms | 19,493 | 19,493 | 1 | false |
| b2-final-run3 | 19,485 | 19,485 | 0 | 0 | 0 | 0 | 40.0401 | 30.686 ms | 26.853 ms | 46.474 ms | 56.292 ms | 84.400 ms | 19,485 | 19,485 | 1 | false |

Runs 2 and 3 have both raw k6 output and database assertions. `booking_duration` is the booking-request trend; `http_req_duration` includes setup/authentication traffic and is not booking-only.

## Reproduction commands

```powershell
# From the repository root; use only the isolated test database.
$env:BASE_URL='http://127.0.0.1:3010'
$env:DB_HOST='127.0.0.1'; $env:DB_PORT='3310'; $env:DB_NAME='beautycare_test'

# Prepare/clean prefixed test users and run B1 or B2 in the Docker k6 image.
node backend/scripts/prepare-k6-booking-users.js
docker run --rm --network host -v "${PWD}:/work" -w /work grafana/k6 run `
  -e BASE_URL=$env:BASE_URL -e WORKLOAD=B2 -e RUN_ID=b2-final-run3 `
  performance/k6-booking.js
node backend/scripts/capture-k6-booking-assertion.js
node backend/scripts/cleanup-k6-booking-users.js
```

The actual raw commands and environment are also represented by the retained console logs. Tool versions used were k6 `2.3.0` (Docker image), Node.js `v24.12.0`, MySQL `8.4`, and Docker Desktop Engine. No Git commit hash is available.

## Raw evidence

- k6 JSON and console logs: `raw-results/k6-booking/`
- B1 assertions: `b1-final-run1-db-assertion.json`, `b1-final-run2-db-assertion.json`, `b1-final-run3-db-assertion.json`
- B2 assertions: `b2-final-run2-db-assertion.json`, `b2-final-run3-db-assertion.json`
- Source: `performance/k6-booking.js`, `backend/scripts/prepare-k6-booking-users.js`, `backend/scripts/capture-k6-booking-assertion.js`

## Limitations

These measurements are local application/database observations, not production capacity limits. B2 intentionally generates unique future slots, so it evaluates sustained authenticated write throughput and invariant preservation rather than same-slot contention. Email delivery is configured as an outbox in the test environment; the backend console can therefore contain one outbox message per booking, but those logs are not used to calculate latency. The historical public-read and 400/500 VU artifacts remain separate and are not merged with B1/B2.

## Academic result statement

Under the isolated local MySQL configuration, the stateful booking experiment preserved the declared business invariants under both adversarial contention and sustained authenticated writes. Across three 50-user same-slot repetitions, the system accepted exactly three bookings per slot and rejected the remaining 47 requests in each repetition, with no database capacity violation. In the sustained workload, the final two database-verified repetitions completed 19,493 and 19,485 successful bookings respectively, with zero unexpected responses and no slot exceeding one booking. These observations support a bounded claim that the implemented booking serialization and capacity checks were effective under the tested local conditions; they do not constitute a production capacity guarantee.
