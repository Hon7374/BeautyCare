# Báo cáo kết luận provenance 400 VU

## A. Đã tìm thấy bao nhiêu bản ghi 400 VU?

Có ba bản ghi cần tách riêng: A là số liệu JSON lịch sử được các báo cáo trích dẫn nhưng file raw hiện không còn trong repository; B là mô tả một lần chạy bị dừng sau khoảng 14 giây; C là JSON 400 VU mới, hiện còn trong `results/iccIT-replication/`.

## B. Nguồn gốc từng bản ghi

A xuất phát từ các báo cáo nghiên cứu cũ và được dẫn là `results/k6-load-400vus.json`, nhưng artifact này không tồn tại để hash hoặc kiểm tra lại. B xuất phát từ `docs/EXPERIMENT_RESULTS.md` và `docs/PAPER_UPDATE_GUIDE.md`, không có console log/manifest. C là artifact raw được tạo bởi bộ chạy an toàn với MySQL disposable, backend localhost và k6 containerized; tuy nhiên lần chạy đó không có manifest contemporaneous.

## C. Mâu thuẫn đã được giải quyết chưa?

Chỉ giải quyết được ở mức phân loại: A và B không được gộp; C là một run riêng. Không thể chứng minh A và B là cùng run hay hai run độc lập. Trạng thái cuối: `PARTIALLY RESOLVED`.

## D. Nguyên nhân khác biệt

Không có nguyên nhân nào được xác nhận. Khác biệt duration, backend/script version, DB pool, rate limiter, logging, máy/container và readiness đều là giả thuyết có thể xảy ra nhưng thiếu snapshot theo run.

## E. Kết quả có thể đưa vào bài báo

C có thể đưa vào như một local public-read observation: 400 VU, 300.293 giây, 302,936 requests, 0% HTTP failure, mean 396.072 ms, p95 446.824 ms. Không được gọi đây là production capacity pass. A chỉ dùng như historical failure observation; B chỉ dùng như historical interruption observation.

## F. Dữ liệu không thể khôi phục

Không khôi phục được raw JSON A, command transcript, exact start/end timestamps, k6 version, backend commit, CPU/RAM/container limits, DB pool, limiter, logging mode và test-data snapshot của A/B. PSReadLine matching history, Git history và VS Code terminal history cũng không cung cấp các lệnh tương ứng.

## G. Manifest mới

`tools/new-experiment-manifest.ps1` đã được tạo với `Check`, `Start` và `Finalize`. `Check` đã được thiết kế để chỉ kiểm tra cấu hình và không chạy load test; `Start/Finalize` ghi hash, timestamp, môi trường đã redact, đường dẫn artifact và trạng thái.

## H. Nội dung bài báo cần thay

Thay mọi câu khẳng định “400 VU completed/pass” bằng mô tả phân biệt A/B/C, nêu rõ C là benchmark public `GET /api/services` trên localhost và không đại diện cho production hoặc end-to-end BeautyCare.

## I. Có cần chạy lại không?

Không cần chạy lại để kết luận provenance hiện tại. Nếu muốn tăng khả năng tái lập, mục tiêu tiếp theo là chạy một lần 400 VU với manifest đầy đủ và một lần 400 VU interruption/overload có console log đầy đủ, đồng thời giữ nguyên script hash, backend version, DB config và environment snapshot. Không được dùng lần chạy mới để sửa hoặc ghi đè artifact lịch sử.
