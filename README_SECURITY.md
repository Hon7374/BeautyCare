# BeautyCare Demo – Nâng cấp bảo mật (bám đề tài)

Phiên bản này bổ sung các mục “hướng phát triển/production-grade” mà hội đồng hay hỏi sâu:

## 1) Token không lưu localStorage nữa
- Backend phát **access token (ngắn hạn)** và **refresh token (dài hạn)** qua **HttpOnly cookies**.
- Frontend gọi API kèm `credentials: 'include'`.

## 2) Refresh token + rotation
- Endpoint: `POST /api/auth/refresh`.
- Mỗi lần refresh sẽ **xoay vòng refresh token**, lưu vào bảng `refresh_tokens` và thu hồi token cũ.

## 3) Quy trình tài khoản an toàn hơn
- **Quên mật khẩu / đặt lại mật khẩu**:
  - `POST /api/auth/forgot-password` (demo trả về token)
  - `POST /api/auth/reset-password`
- **Xác minh email**:
  - `POST /api/auth/request-verify-email` (demo trả về token)
  - `POST /api/auth/verify-email`
- **2FA (TOTP)**:
  - `POST /api/auth/2fa/setup`
  - `POST /api/auth/2fa/enable`
  - `POST /api/auth/2fa/disable`

## 4) CSRF Protection (double-submit)
- Backend tạo cookie `csrf_token` và yêu cầu header `X-CSRF-Token` cho các request thay đổi dữ liệu.
- Frontend tự gọi `GET /api/auth/csrf` khi thiếu token.

## 5) CSP/Security headers
- Backend dùng **helmet** bật nhiều security headers (có CSP mức demo).

## 6) HTTPS (phụ thuộc môi trường)
- Có code chạy HTTPS nếu đặt `HTTPS=true` và cung cấp `SSL_KEY_PATH` + `SSL_CERT_PATH`.
- Trong production cần TLS/HTTPS bắt buộc.

## 7) Logging / Audit / Monitoring
- Request log: morgan -> winston (`backend/logs/app.log`)
- Correlation ID: header `X-Request-ID`
- Audit log: bảng `audit_logs`
- Metrics Prometheus (tuỳ chọn): `/api/metrics` khi bật `METRICS=true` (có thể đặt `METRICS_KEY`)

## 8) Kiểm thử & dependency scan
- `npm run lint`
- `npm test`
- `npm run audit`

## 9) Thanh toán online + gói thành viên nhiều cấp độ (bám đề tài)
- API: `POST /api/payments/checkout` (mua dịch vụ) và `POST /api/payments/subscribe` (mua gói thành viên)
- Hỗ trợ provider: **VNPay**, **MoMo**, **Stripe**
- Có chế độ demo offline: đặt `PAYMENTS_MODE=mock` trong `backend/.env`
  - Khi đó hệ thống sẽ mở một "Mock Gateway" local để mô phỏng thanh toán thành công/thất bại
- Frontend:
  - `user/payment.html` → chọn cổng thanh toán → **Thanh toán online**
  - `user/membership.html` → chọn gói → **Mua gói**
  - Kết quả: `user/payment-result.html` tự đồng bộ trạng thái từ backend

---

## Cách chạy (gợi ý nhanh)
1. **Database**: chạy file `database/beautycare.sql` (đã có thêm bảng refresh_tokens/password_reset_tokens/email_verify_tokens).
2. **Backend**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   node server.js
   ```

### Chạy HTTPS local (self-signed)
Trong `backend/scripts/`:
```powershell
cd backend
./scripts/gen-cert.ps1
```
Sau đó bật trong `.env`:
```
HTTPS=true
SSL_KEY_PATH=./certs/localhost.key
SSL_CERT_PATH=./certs/localhost.crt
COOKIE_SECURE=true
```
3. **Frontend**: mở `frontend/index.html` bằng Live Server.
   - `js/config.js` tự lấy hostname để dùng được cả `localhost` lẫn `127.0.0.1`.
4. **Demo bảo mật**:
   - Đăng nhập → vào `Hồ sơ`/`Bảo mật` để bật 2FA, tạo token xác minh email.
   - Quên mật khẩu: `forgot.html` → `reset.html`.

---

## Test bảo mật (Jest)
Xem hướng dẫn chi tiết: `docs/SECURITY_TESTING.md`.

Chạy nhanh:
```bash
cd backend
npm test
```

