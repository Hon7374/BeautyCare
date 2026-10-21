# Final research evidence report

**Audit date:** 2026-10-17 (Asia/Saigon)

## New verification run

The previously blocked safe replication was completed on 2026-10-17 using a disposable MySQL container, a localhost backend on port 3010, and containerized k6. Nine runs were completed at 100, 200, and 300 VUs, three repetitions each; an additional 400-VU run completed for five minutes with zero HTTP failures. The 500-VU attempt was aborted after immediate `connection refused` errors; its partial k6 summary is retained separately as `results/k6-load-500vus.json`. Aggregate results for the nine repeated runs are in `results/iccIT-replication/aggregate-summary.json`; individual summaries are in the same directory.

| VU | Runs | Mean RPS | RPS min–max | Mean latency | Mean p95 | HTTP failure |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | 3 | 816.117 | 645.935–1054.982 | 127.596 ms | 321.463 ms | 0% |
| 200 | 3 | 1106.162 | 1069.020–1129.001 | 180.735 ms | 230.859 ms | 0% |
| 300 | 3 | 1058.341 | 1028.114–1082.811 | 283.301 ms | 353.933 ms | 0% |

## A. Đã xác minh được điều gì?

- JSON 400 VU hợp lệ về cấu trúc, ghi 400 VU, khoảng 300 giây, 1,244,906 requests/iterations, 91,742 HTTP 200 và 1,153,164 request thất bại/other. `http_req_failed = 92.63060825%` được tính đúng.
- Throughput 4,149.372 requests/s bao gồm failed requests; successful HTTP 200 throughput khoảng 305.784/s.
- Script k6 chỉ gọi `GET /api/services`, constant VU, không auth, không sleep.
- Historical 100/200/300 VU five-minute artifacts ghi 0% HTTP failures; new 2026-10-17 replication also completed 100/200/300 VU with 0% HTTP failures across three repetitions per profile.
- New 400 VU artifact completed 300.293 seconds with 302,936 requests, 302,936 HTTP 200 responses, and 0% HTTP failure; it is a separate local public-read observation and does not resolve the historical A/B provenance conflict.
- The 500 VU attempt was separately aborted after connection-refused errors; it is not merged with any 400 VU record.
- Historical environment ghi Node v24.12.0, npm v11.12.1, Docker MySQL 8.4.11 và localhost benchmark; phần cứng và k6 version không được ghi.
- Reference [20] được xác minh: Qadir, Waheed, Khanum, Jehan; title dùng `&`; PeerJ Computer Science, vol. 11, e2821, 2025, DOI 10.7717/peerj-cs.2821.

## B. Mâu thuẫn

**RESOLVED:** Tỷ lệ lỗi JSON 400 VU; phân biệt requests/s với successful responses/s; script workload là public-read endpoint.

**UNRESOLVED:** Quan hệ giữa JSON 400 VU ~5 phút và báo cáo 400 VU dừng sau ~14 giây/12,486 iterations. Không có run manifest, timestamp khởi động, command transcript hoặc raw console log đủ để chứng minh chúng là cùng một run hay hai run khác nhau.

## C. Thông tin còn thiếu

- CPU model, physical/logical cores, RAM, container limits của run lịch sử.
- k6 version, exact backend version/commit, script hash và process environment.
- Start/end timestamps và command transcript của cả hai record 400 VU.
- Database pool/rate limiter/logging snapshot gắn với từng run.
- Bản thảo ICCIT để đối chiếu page/section/câu chữ cụ thể.
- Hardware snapshot and k6 image digest for the new run, if stricter infrastructure provenance is required.

## D. Bài báo cần sửa

| Vị trí | Nội dung cần sửa | Thay thế |
|---|---|---|
| Performance Results | “400 VU completed/pass” | “The retained 400-VU evidence is failure-affected and internally conflicting; it is reported as an overload observation, not a capacity pass.” |
| Performance Method | “system load test” nếu dùng nghĩa toàn hệ thống | “constant-VU public `GET /api/services` benchmark” |
| Security Design | “signed/session-bound CSRF” | “conventional naive double-submit-cookie CSRF validation” |
| Security Evaluation | “full penetration testing” cho ZAP baseline | “OWASP ZAP baseline scan with retained alert categories” |
| Discount Evaluation | “voucher/membership fully tested” | “static implementation evidence; runtime edge-case verification was not retained” |
| References [20] | `approaches and tools` hoặc metadata thiếu | Dùng citation đã hiệu chỉnh trong file 04 |

## E. Đủ điều kiện công bố

Chỉ các kết quả sau đủ bằng chứng để công bố với giới hạn rõ ràng: historical 100/200/300 VU public-read profiles; 400/500 VU as failure/overload observations; historical security regression counts; isolated MySQL 5/5 evidence; retained VNPay sandbox summary; ZAP baseline alert counts; source-based CSRF and pricing descriptions; verified Reference [20].

## F. Cần người dùng phê duyệt

- Xác nhận disposable localhost backend + isolated test database.
- Any 400/500 VU result must be reported as a separately identified overload-profile observation with a contemporaneous manifest; historical A/B records must not be merged.
- Cung cấp bản thảo ICCIT để lập bảng Page/Section/Original/Replacement.
- Cung cấp run manifest/raw console logs nếu muốn giải quyết conflict 400 VU.

## G. Danh sách file

- `docs/paper_evidence_final/01_400VU_Investigation.md`
- `docs/paper_evidence_final/02_Experiment_Reproducibility.md`
- `docs/paper_evidence_final/03_Load_Test_Replication_Plan.md`
- `docs/paper_evidence_final/04_Reference_20_Verification.md`
- `docs/paper_evidence_final/05_Paper_Claim_Review.md`
- `docs/paper_evidence_final/06_ICCIT_Replacement_Content.md`
- `docs/paper_evidence_final/07_Final_Research_Report.md`
- `docs/paper_evidence_final/summary.json`
- `results/iccIT-replication/aggregate-summary.json`

