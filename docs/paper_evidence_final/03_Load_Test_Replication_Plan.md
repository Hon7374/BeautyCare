# Kế hoạch tái lập load test

## Approval gate

Không chạy 100/200/300 VU trước khi người dùng xác nhận rõ môi trường localhost/test database và cho phép chạy ba repetition ở từng mức. 400/500 VU là overload profiles; chỉ chạy sau khi có xác nhận riêng và phải dừng nếu xuất hiện connection refusal diện rộng.

## Proposed safe procedure

1. Tạo hoặc xác nhận disposable MySQL test database; import `database/beautycare.mysql.sql`; không dùng database production/development chứa dữ liệu thật.
2. Khởi động backend trên `127.0.0.1` với `NODE_ENV` non-production, `PERF_TEST=true`, `PUBLIC_APP_URL` localhost và access logging performance mode.
3. Ghi environment manifest: OS, CPU/RAM, Node/npm/k6/MySQL versions, pool size, queue limit, limiter, target URL/port, script hash, start/end timestamp.
4. Health-check target và xác nhận endpoint chỉ là `GET /api/services`.
5. Chạy tuần tự 100, 200, 300 VU; mỗi mức ba lần, dùng cùng duration và cùng configuration.
6. Dừng mức kế tiếp nếu connection refusal liên tục, DB queue tăng không kiểm soát, process instability, hoặc lỗi dữ liệu.
7. Lưu mỗi raw summary riêng theo profile/repetition; không ghi secret, cookie, token hoặc customer data.
8. Tính cho từng mức: mean, standard deviation, min, max của request rate và latency; báo cáo từng run cùng aggregate, không thay thế run-level values.

## Proposed output naming

`results/replication-100vus-run01.json`, `...run02.json`, `...run03.json`, tương tự cho 200 và 300; kèm `replication-environment-<timestamp>.json` không chứa secret.

## Execution status

The procedure was executed on 2026-10-17 for 100/200/300 VUs, three repetitions per profile. All nine runs completed with zero interrupted iterations and zero k6 HTTP failures. Aggregate values are stored in `results/iccIT-replication/aggregate-summary.json`. This new evidence remains limited to the public `GET /api/services` workload.

## Publication rule

Chỉ công bố profile khi cả ba repetition hoàn tất với raw summaries và environment manifest. Nếu chỉ chạy một lần, ghi `single-run evidence`; nếu bị dừng, ghi `interrupted/overload observation`. Không gọi kết quả endpoint-read benchmark là toàn hệ thống capacity.

