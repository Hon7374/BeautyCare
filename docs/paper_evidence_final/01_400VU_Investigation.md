# Điều tra mâu thuẫn dữ liệu 400 VU

**Ngày kiểm tra:** 2026-10-17, Asia/Saigon. Không chạy lại k6.

## Bằng chứng đã truy vết

| Bản ghi | Nguồn | VU | Thời lượng ghi nhận | Requests | Iterations | HTTP 200 | Failed/other | Throughput |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A | `results/k6-load-400vus.json`, `state.testRunDurationMs` | 400 | 300.023 s (~5 phút) | 1,244,906 | 1,244,906 | 91,742 | 1,153,164 | 4,149.372 requests/s |
| B | `docs/EXPERIMENT_RESULTS.md:79`, `docs/PAPER_UPDATE_GUIDE.md:33` | 400 | khoảng 14 s | Không có JSON summary | 12,486 quan sát trước interruption | Không ghi nhận | connection refused | Không xác định |

## Kiểm tra JSON A

`results/k6-load-400vus.json` là JSON hợp lệ và có các trường `metrics`, `options`, `state`, `root_group`. Artifact ghi:

- `vus`: min/value/max = 400.
- `http_reqs.count = 1,244,906`; `http_reqs.rate = 4,149.3723909`.
- `iterations.count = 1,244,906`; cùng rate với requests vì script thực hiện một request trong mỗi iteration.
- `http_status_200.count = 91,742`, tương đương 305.784 successful HTTP 200 responses/s.
- `http_status_other.count = 1,153,164`, tương đương 3,843.589/s.
- `http_req_failed.rate = 0.9263060825` = **92.63060825%**; phép tính `1,153,164 / 1,244,906` xác nhận tỷ lệ này.
- `checks`: 91,742 passes và 1,153,164 fails; check là “service listing status is 200”.
- `http_req_duration.avg = 35.480 ms`, p95 = 463.984 ms, p99 = 503.561 ms. Các percentile tổng hợp bao gồm request lỗi; metric `http_req_duration{expected_response:true}` riêng có avg 480.095 ms.

Vì k6 tính `http_reqs` trên toàn bộ request gửi/được ghi nhận, throughput 4,149.372 requests/s **bao gồm cả request thất bại**. Không được gọi con số này là successful-response throughput. Successful 200 throughput quan sát được là khoảng 305.784/s.

## So sánh cấu hình và phiên bản

`performance/k6-load.js:1-47` dùng `GET /api/services`, một request mỗi iteration, constant VUs, không sleep, không authentication, không ramp-up/ramp-down, duration từ `DURATION`, VU từ `VUS`. Script có thể tạo artifact A khi chạy với `VUS=400` và `DURATION=300s`.

`backend/utils/runtime.js:126-142` cho phép performance mode chỉ khi `PERF_TEST=true`, non-production và public URL là localhost. Khi bật mode, API limiter mặc định là 1,000,000/15 phút; ngoài mode là 300/15 phút. `backend/db.js:7-18` ghi nhận pool thông thường mặc định 10, pool performance mặc định 25, tối đa 50 và queue limit performance 1000. `backend/app.js:45-51` tắt per-request console/file writes trong performance mode.

Tuy nhiên, không có command transcript, process environment snapshot, k6 version, backend version/commit, start timestamp hoặc run manifest đủ để chứng minh rằng A và B dùng cùng script/configuration. JSON không ghi version script, version backend, start time, host resource snapshot, DB pool thực tế, hoặc rate-limiter configuration.

## Kết luận điều tra

1. Có **hai bản ghi 400 VU** trong tài liệu/artifact: một JSON run khoảng 5 phút và một mô tả interruption khoảng 14 giây.
2. Hai bản ghi **có thể** là hai lần chạy riêng biệt, nhưng workspace không chứa bằng chứng định danh độc lập để xác nhận điều đó.
3. Không chứng minh được khác biệt cấu hình hoặc phiên bản script giữa hai lần chạy.
4. JSON A đầy đủ ở mức metrics k6 và hợp lệ về cấu trúc, nhưng thiếu provenance metadata.
5. Tỷ lệ lỗi 92.63060825% được tính đúng từ JSON.
6. Throughput 4,149.372 requests/s bao gồm failed requests; successful HTTP 200 throughput là khoảng 305.784/s.
7. Chỉ có thể dùng A như **historical overload/failure observation**, không phải completed capacity pass. B chỉ dùng như historical interruption observation.
8. Không được công bố “400 VU hoàn tất với 0% lỗi”, “400 VU capacity pass”, hoặc gộp A và B thành một run.

**Final classification: `UNRESOLVED EVIDENCE CONFLICT`.** Cần run manifest hoặc raw k6 console output có timestamp/process configuration để phân giải quan hệ giữa A và B.

