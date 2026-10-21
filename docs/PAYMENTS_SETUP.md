# Payments (Online) – Setup & Demo

> Dự án hỗ trợ 2 chế độ:
> - **Mock** (offline demo): không cần tài khoản cổng thanh toán.
> - **Real**: tích hợp **VNPay / MoMo / Stripe / PayPal** (sandbox/test mode).

## 1) Chạy nhanh (Mock – khuyên dùng khi thuyết trình)

1. Vào `backend/` tạo file `.env` dựa trên `.env.example`.
2. Đặt:

```env
PAYMENTS_MODE=mock
FRONTEND_URL=http://127.0.0.1:5500
API_BASE_URL=http://localhost:3000
FRONTEND_ALLOWED_HOSTS=localhost,127.0.0.1
```

3. Chạy backend:

```bash
cd backend
npm install
node server.js
```

4. Chạy frontend bằng **VS Code Live Server**:
   - Mở thư mục `frontend/` → Right click `index.html` → **Open with Live Server**

Luồng demo:
`Dịch vụ → Thanh toán online → Mock Gateway → Kết quả → Lịch sử`

## 2) Fix lỗi redirect “Cannot GET /.../payment-result.html”

Lỗi này xảy ra khi URL frontend có/không có `/frontend` tuỳ cách bạn chạy Live Server.

Phiên bản này đã hỗ trợ gửi `returnBase` từ frontend sang backend.
Backend sẽ dùng giá trị đó để redirect chính xác về trang:

`<returnBase>/user/payment-result.html?...`

Nếu bạn đổi port backend, có thể set trong Console:

```js
localStorage.setItem('API_PORT','3000')
```

## 3) Chế độ Real – cấu hình VNPay / MoMo / Stripe / PayPal

> **Lưu ý:** Bạn cần tài khoản sandbox/test của từng provider.

### 3.1 VNPay (sandbox)

Trong `.env`:

```env
PAYMENTS_MODE=real
VNPAY_TMN_CODE=...
VNPAY_HASH_SECRET=...
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
```

### 3.2 MoMo (test)

```env
PAYMENTS_MODE=real
MOMO_PARTNER_CODE=...
MOMO_ACCESS_KEY=...
MOMO_SECRET_KEY=...
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_REQUEST_TYPE=captureWallet
```

Backend nhận IPN tại:

- `POST /api/payments/momo/ipn`
- Return redirect: `GET /api/payments/momo/return`

### 3.3 Stripe (test)

```env
PAYMENTS_MODE=real
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Webhook endpoint:

- `POST /api/payments/stripe/webhook`

`STRIPE_SECRET_KEY` phải là secret key test (`sk_test_...`) và chỉ nằm ở `backend/.env`; không đưa key này ra frontend. Khi `PAYMENTS_MODE=mock` (mặc định), hoặc khi chưa có key, lựa chọn Stripe vẫn đi qua Mock Gateway để giữ tương thích demo. Chỉ `PAYMENTS_MODE=real` + key Stripe hợp lệ mới tạo Stripe Checkout Session thật.

Sau khi thanh toán, Stripe chuyển về `GET /api/payments/stripe/success` kèm `session_id`. Backend gọi Stripe API bằng secret key, kiểm tra `payment_status=paid`, `status=complete` và `metadata.providerRef` trước khi cập nhật payment local sang `paid`. Vì vậy redirect trình duyệt đơn thuần không thể tự xác nhận thanh toán. Webhook có chữ ký (`STRIPE_WEBHOOK_SECRET`) vẫn là nguồn sự kiện ưu tiên và hỗ trợ cả `checkout.session.async_payment_succeeded`.

#### Kiểm thử Stripe sandbox thực tế

1. Bật **Test mode** trong Stripe Dashboard và tạo Restricted/Secret test key (`sk_test_...`).
2. Đặt `PAYMENTS_MODE=real`, `STRIPE_SECRET_KEY`, `API_BASE_URL` và `PUBLIC_APP_URL` trong `backend/.env`, sau đó khởi động lại backend.
3. Để nhận webhook trên máy local, chạy Stripe CLI:

```bash
stripe listen --forward-to http://localhost:3000/api/payments/stripe/webhook
```

   Sao chép giá trị `whsec_...` CLI in ra vào `STRIPE_WEBHOOK_SECRET`, rồi khởi động lại backend.
4. Đăng nhập, chọn dịch vụ/lịch hẹn, chọn **Stripe**, và hoàn tất Stripe Checkout bằng thẻ test `4242 4242 4242 4242`, ngày hết hạn bất kỳ trong tương lai, CVC bất kỳ.
5. Lưu bằng chứng vào báo cáo: URL `checkout.stripe.com`, Stripe Dashboard event `checkout.session.completed` (hoặc log Stripe CLI), `ref` của BeautyCare, và kết quả `GET /api/payments/status/:ref` là `paid`. Kiểm tra thêm dòng `payments.status='paid'` và order/booking liên quan.

Không được ghi `sk_test_...`, `whsec_...`, số thẻ, hoặc dữ liệu webhook đầy đủ vào báo cáo/log công khai. Nếu chưa có Stripe test account/key, chỉ có thể kiểm thử đơn vị với mock; không được tuyên bố đã có giao dịch sandbox thực tế.

### 3.4 PayPal (sandbox)

PayPal dùng Orders API v2. Nếu chưa điền `PAYPAL_CLIENT_ID` và `PAYPAL_CLIENT_SECRET`, hệ thống tự chuyển PayPal sang Mock Gateway để demo vẫn chạy được.

```env
PAYMENTS_MODE=real
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_CURRENCY=USD
PAYPAL_EXCHANGE_RATE=25000
PAYPAL_BRAND_NAME=BeautyCare
PAYPAL_LOCALE=vi-VN
```

Backend tạo đơn PayPal tại `/v2/checkout/orders`, chuyển người dùng sang link `approve`, rồi capture tại:

- `GET /api/payments/paypal/return`
- `GET /api/payments/paypal/cancel`

Lưu ý: giá trong hệ thống đang là VND, còn PayPal thường dùng tiền tệ quốc tế như USD. Vì vậy demo đã có `PAYPAL_EXCHANGE_RATE` để quy đổi số tiền gửi sang PayPal.

## 4) Kiểm thử nhanh

1. Đăng nhập user.
2. Chọn 1 dịch vụ → Thanh toán online.
3. Kiểm tra:
   - `Lịch sử` (payments/transactions)
   - `Kết quả thanh toán` tự poll `/api/payments/status/:ref`
