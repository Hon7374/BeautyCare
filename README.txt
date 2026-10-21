TEN DE TAI:
BeautyCare - He thong quan ly khach hang va giam gia an toan

CONG NGHE:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js (Express)
- Database: MySQL
- Bao mat: JWT, bcrypt, CSRF, 2FA, CSP

HUONG DAN CHAY:
1. Import file `database/beautycare.mysql.sql` vao MySQL
2. `cd backend`
3. `npm install`
4. Copy `.env.example` thanh `.env`
5. `node server.js`
6. Mo `http://localhost:3000`

TAI KHOAN DEMO:
- Admin: `khucmai51@gmail.com / 123456`
- User: `user@gmail.com / 123456`

VOUCHER DEMO:
- `BEAUTY10`

GHI CHU:
- Backend chay mac dinh tai `http://localhost:3000`
- Neu dung cau hinh MySQL khac, sua cac bien `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` trong `backend/.env`

TINH NANG NOI BAT:
- Quan ly tai khoan an toan: dang ky, dang nhap, refresh token rotation, CSRF, 2FA, verify email, reset password
- Chinh sach giam gia nhieu cap: tier membership + voucher + tran cong don
- Thanh toan online da cong: VNPay / MoMo / Stripe, co mock mode de demo
- Membership va loyalty: mua goi, nang tier, gia han, giu chan khach hang
- Admin: quan ly users, services, vouchers, bookings, transactions, subscriptions

LUU Y:
- Schema chinh thuc cua repo la `database/beautycare.mysql.sql`
- Repo chi su dung schema MySQL
