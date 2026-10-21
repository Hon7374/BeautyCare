# Load-test environment and reproducibility

## Provenance

The environment below is copied from the historical report `docs/EXPERIMENT_RESULTS.md:1-9,61-87`, dated 2026-09-27. It is **historical evidence**, not a measurement of the current machine on 2026-10-17.

| Item | Historical evidence |
|---|---|
| OS | Windows PowerShell environment |
| Node/npm | Node.js v24.12.0; npm v11.12.1 |
| Database | Docker MySQL 8.4.11, test instance at 127.0.0.1:3310 |
| Target | Local benchmark server at 127.0.0.1:3001 |
| Mode | `PERF_TEST=true`, non-production localhost only |
| Pool | Performance default 25, capped at 50; queue limit 1000 |
| Script | `performance/k6-load.js` |
| API mix | One `GET /api/services` per iteration; no authentication; no sleep |
| Workload model | Constant VUs for the configured duration |
| Thresholds | HTTP failure rate <1%; p95 <1500 ms; p99 <3000 ms |

The script does not exercise authenticated booking, voucher, membership, payment, or CSRF flows. It is therefore an endpoint throughput benchmark, not an end-to-end business-workload benchmark.

Hardware model, physical/logical CPU counts, RAM, container limits, and DB queue wait metrics were not retained in the reviewed artifacts: **NOT VERIFIED**.

