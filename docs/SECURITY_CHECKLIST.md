# SECURITY CHECKLIST (Demo -> Production)

Tài liệu này giúp bạn đối chiếu đề tài **“Web TMĐT an toàn – Quản lý tài khoản – Chính sách giảm giá”** với các hạng mục ATTT phổ biến (OWASP Top 10) và những gì hệ thống đã triển khai.

## 1) Xác thực & phiên làm việc
- ✅ Mật khẩu được **hash bằng bcrypt** (không lưu plain-text).
- ✅ Xác thực phiên bằng **cookie HttpOnly** (access/refresh token).
- ✅ **Refresh token rotation** + lưu DB + thu hồi khi logout.
- ✅ Logout có hiệu lực thật (thu hồi refresh + access token theo jti).
- ✅ CSRF protection (double-submit cookie) cho các request state-changing.
- ✅ 2FA TOTP (Google Authenticator) cho tài khoản.
- ✅ Flow quên mật khẩu & xác minh email (demo trả token để test).

## 2) Phân quyền & kiểm soát truy cập
- ✅ RBAC: user/admin, route admin được bảo vệ.
- ✅ Không trả password hash về client.
- ✅ Audit log cho thao tác admin quan trọng.

## 3) Chống tấn công phổ biến
- ✅ Rate limit (toàn API + login) chống brute-force.
- ✅ Validate input (express-validator) cho auth, voucher, booking, admin CRUD.
- ✅ Helmet + CSP (đang để mức “demo-friendly”; có hướng siết trong DEPLOYMENT).
- ✅ Limit JSON body để giảm abuse.

## 4) Giám sát & log
- ✅ Request log (morgan -> winston).
- ✅ Correlation ID (X-Request-ID).
- ✅ Audit logs trong DB.
- ✅ Metrics Prometheus (tuỳ chọn) qua /api/metrics.

## 5) Những mục “nâng cao” khi deploy thật
- ⬜ Bắt buộc HTTPS + HSTS (đã hỗ trợ bật HTTPS trong server.js, cần cert).
- ⬜ CSP nghiêm ngặt (loại bỏ inline scripts, chuyển sang JS event listeners).
- ⬜ Email thực (SMTP) thay vì demo token.
- ⬜ Chính sách mật khẩu mạnh hơn (entropy, block breached passwords).
- ⬜ CI: SAST, dependency scanning, unit/integration tests mở rộng.
