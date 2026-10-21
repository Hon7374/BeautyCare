# Khả năng tái lập thực nghiệm

## Historical verified configuration

Các giá trị sau được lấy từ `docs/EXPERIMENT_RESULTS.md:1-9,61-87`, `performance/k6-load.js`, `backend/utils/runtime.js`, `backend/db.js` và `backend/app.js`. Chúng là cấu hình lịch sử, không phải cấu hình hiện tại của máy.

| Thành phần | Historical evidence |
|---|---|
| OS | Windows PowerShell environment; model/build chi tiết: NOT RECORDED |
| CPU/RAM/container limit | NOT RECORDED |
| Node/npm | Node.js v24.12.0; npm v11.12.1 |
| MySQL | Docker MySQL 8.4.11 tại 127.0.0.1:3310 trong báo cáo lịch sử |
| k6 | NOT RECORDED |
| Backend target | 127.0.0.1:3001 |
| Performance mode | `PERF_TEST=true`, non-production localhost |
| DB pool | Historical report: performance default 25, capped at 50, queue limit 1000; original non-performance pool 10/unbounded queue |
| Rate limiter | Performance mode default 1,000,000/15 phút; normal default 300/15 phút |
| Logging | Performance mode bỏ per-request console/file writes; vẫn giữ security/error logging |
| Express | Package range `^4.18.2`; exact installed version tại thời điểm run: NOT RECORDED |

## Current environment configuration

Các lệnh kiểm tra hiện tại chỉ đọc môi trường, không chạy benchmark:

- Node.js: v24.12.0.
- npm: v11.12.1.
- k6: không có trong PATH (`NOT AVAILABLE`).
- Docker daemon: không kết nối được trong workspace hiện tại (`NOT AVAILABLE`).
- WMI queries để đọc CPU/RAM bị từ chối quyền (`NOT VERIFIED`).
- Database version, availability và isolation hiện tại: `NOT VERIFIED`; không dùng `.env` để chạy test.

Không được gán các giá trị hiện tại này cho thực nghiệm lịch sử ngày 2026-09-27.

## Script semantics

`performance/k6-load.js:6-21,31-47` xác định `VUS` mặc định 100, `DURATION` mặc định 60s, workload constant-VU, một `GET /api/services` trong mỗi iteration, không authentication, không request body, không sleep. Thresholds là `http_req_failed < 1%`, p95 < 1500 ms và p99 < 3000 ms. Failure rate là metric k6 `http_req_failed`; script cũng đếm status 200/429/3xx/4xx/5xx/other.

Do mỗi iteration chỉ có một request, requests và iterations bằng nhau trong artifact. Điều này không biến benchmark thành đại diện cho booking, payment, membership, voucher hoặc CSRF workload.

## Safe replication readiness

The previously blocked replication was executed on 2026-10-17 after Docker Engine became available. A disposable MySQL container and a localhost backend were used; the k6 runner ran in a container. Nine safe runs completed at 100, 200, and 300 VUs, three repetitions per profile. A separate 400-VU run also completed for five minutes with zero HTTP failures. A 500-VU attempt immediately encountered connection refusal and was aborted; its partial k6 summary is retained separately as `results/k6-load-500vus.json`.

The new run artifacts are under `results/iccIT-replication/`. The exact hardware snapshot and k6 image digest were not retained, so those provenance fields remain incomplete even though the run itself completed.

