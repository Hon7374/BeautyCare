# BeautyCare Security Demo

## Mục đích

Script trong thư mục này tự:

- dựng MySQL demo riêng trong `demo/runtime/`
- import `database/beautycare.mysql.sql`
- khởi động backend đúng kiến trúc repo
- mở browser desktop thật
- tự thao tác UI cho các luồng bảo mật
- quay full desktop và lưu video cuối vào:

`demo/beautycare-security-demo.mkv`

## Dependency

- Windows
- Node.js
- Python 3
- MySQL Server 8.0 binaries tại `C:\Program Files\MySQL\MySQL Server 8.0\bin\`
- Chrome hoặc Edge desktop
- `ffmpeg`

Nếu `ffmpeg` chưa có, script PowerShell sẽ tự thử cài bằng `winget` hoặc `choco`.

## Cách chạy

Từ root repo:

```powershell
powershell -ExecutionPolicy Bypass -File demo\run-security-demo.ps1
```

Script sẽ tự tạo virtualenv trong `demo/.venv`, cài Python packages cần thiết, rồi chạy toàn bộ quy trình.

Nếu chạy thành công, script sẽ tự mở:

- video `demo/beautycare-security-demo.mkv`
- file hướng dẫn `demo/README-demo.md`

## File quan trọng

- Video cuối: `demo/beautycare-security-demo.mkv`
- Script chạy lại: `demo/run-security-demo.ps1`
- Orchestrator chính: `demo/security_demo.py`
- Runtime tạm: `demo/runtime/`

## Ghi chú

- Script không ghi đè `backend/.env`; backend được chạy với biến môi trường override chỉ trong session demo.
- Mỗi lần chạy script sẽ dựng lại MySQL demo riêng để luồng password/email/2FA luôn ổn định.
- Sau khi video kết thúc, backend demo vẫn được giữ chạy để bạn có thể kiểm tra lại trên browser nếu muốn.
