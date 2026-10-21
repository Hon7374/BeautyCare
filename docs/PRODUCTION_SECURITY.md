# Triển khai bảo mật vận hành

Tài liệu này mô tả các cơ chế đang chạy trong BeautyCare, cùng cấu hình production có thể kiểm chứng. Nó không thay thế việc quản lý bí mật, tường lửa và chứng thư TLS ở hạ tầng triển khai.

## Cơ chế bảo vệ dữ liệu và tài khoản

- Mật khẩu được băm bằng `bcrypt`; API không trả password hash về trình duyệt.
- Access token và refresh token được phát qua cookie `HttpOnly`; refresh token có `SameSite=Strict`, path hẹp `/api/auth`, được xoay vòng và có thể thu hồi trong cơ sở dữ liệu.
- Cookie CSRF đọc được bởi frontend chỉ dùng cho mô hình double-submit; mọi request thay đổi dữ liệu có session cookie phải gửi `X-CSRF-Token` khớp cookie.
- JWT kiểm tra chữ ký, hạn dùng và danh sách token đã thu hồi. Các route quản trị yêu cầu vai trò admin.
- 2FA TOTP, xác minh email, đặt lại mật khẩu, audit log cho thao tác quan trọng, giới hạn tốc độ API/login và giới hạn kích thước JSON đều được triển khai ở backend.
- Helmet đặt các security header. CSP chặn inline script; production không cho `http:` ở `img-src`, và `connect-src` chỉ còn same-origin.
- Request có `X-Request-ID`, log ứng dụng và audit log để truy vết; metrics là tùy chọn và có thể bảo vệ bằng `METRICS_KEY`.

## HTTPS, HSTS và reverse proxy

`NODE_ENV=production` tự bật HTTP-to-HTTPS redirect trong `backend/app.js` và HSTS qua Helmet. HSTS mặc định có giá trị:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Có hai topology hợp lệ:

1. Node tự kết thúc TLS: `HTTPS=true`, đặt `SSL_KEY_PATH` và `SSL_CERT_PATH`.
2. Proxy/load balancer kết thúc TLS: `HTTPS=false`, `ENFORCE_HTTPS=true`, và đặt `TRUST_PROXY` đúng với số hop hoặc IP/range của proxy (ví dụ `1`). Origin server phải chỉ nhận kết nối từ proxy.

Không đặt `TRUST_PROXY` theo mặc định. Điều này ngăn client trực tiếp giả mạo `X-Forwarded-Proto: https` để vượt qua redirect. Ở production, server từ chối khởi động nếu không có TLS trực tiếp hoặc proxy được khai báo; nếu dùng TLS trực tiếp nhưng file cert/key không đọc được, server cũng dừng thay vì rơi về HTTP.

`HSTS_PRELOAD=false` là mặc định có chủ đích. Chỉ bật preload khi toàn bộ subdomain hiện tại và tương lai đều hỗ trợ HTTPS lâu dài.

## CORS theo domain

`CORS_ORIGINS` là allowlist origin chính xác (scheme + hostname + port), không chấp nhận wildcard, path hay query string. CORS có `credentials=true`, vì vậy `*` không được dùng.

Ví dụ production:

```env
CORS_ORIGINS=https://app.example.vn
```

Ở development, localhost vẫn được phép để chạy demo. Ở production, localhost và mọi origin chưa khai báo bị trả `403`; server cũng từ chối khởi động khi `CORS_ORIGINS` rỗng/không hợp lệ. Mẫu cấu hình hoàn chỉnh: `backend/.env.production.example`.

## Kiểm thử hồi quy cho lớp vận hành

Các test no-DB trong `backend/tests/security.no-db.test.js` kiểm tra:

- redirect `308` khi HTTPS bị ép;
- header `X-Forwarded-Proto` giả mạo bị bỏ qua nếu không cấu hình proxy;
- request HTTPS qua proxy được tin cậy nhận HSTS và CORS header cho origin trong allowlist;
- origin ngoài allowlist bị `403`.

Chạy:

```powershell
cd backend
npm run test:smoke
```

Với MySQL đã import đầy đủ schema, chạy `npm run test:all` theo hướng dẫn ở `docs/SECURITY_TESTING.md` để bao gồm integration/security flow.
