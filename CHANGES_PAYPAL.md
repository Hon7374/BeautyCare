# Thay đổi: thêm phương thức thanh toán PayPal

Đã thêm PayPal vào các luồng thanh toán chính của BeautyCare:

- Thanh toán đơn dịch vụ tại `frontend/user/payment.html`.
- Thanh toán gói thành viên tại `frontend/user/membership.html`.
- Hiển thị tên phương thức PayPal trong lịch sử thanh toán.
- Backend hỗ trợ tạo PayPal order và capture thanh toán qua PayPal Orders API v2.
- Khi chưa cấu hình PayPal sandbox/live key, hệ thống tự rơi về Mock Gateway để demo không bị lỗi.

## File đã sửa/thêm

- `backend/routes/payments.js`
- `backend/utils/providers/paypal.js`
- `backend/.env`
- `backend/.env.example`
- `frontend/user/payment.html`
- `frontend/user/membership.html`
- `frontend/js/historyPage.js`
- `docs/PAYMENTS_SETUP.md`

## Cấu hình PayPal thật

Điền các biến sau trong `backend/.env`:

```env
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_CURRENCY=USD
PAYPAL_EXCHANGE_RATE=25000
PAYPAL_BRAND_NAME=BeautyCare
PAYPAL_LOCALE=vi-VN
```

Nếu để trống `PAYPAL_CLIENT_ID` hoặc `PAYPAL_CLIENT_SECRET`, phương thức PayPal vẫn xuất hiện trong giao diện nhưng backend sẽ dùng mock payment để demo.

## Kiểm tra nhanh

Đã chạy kiểm tra cú pháp JavaScript cho backend và frontend. Không phát hiện lỗi cú pháp.
