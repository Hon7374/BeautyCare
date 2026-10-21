# Security Testing Guide

Tai lieu nay mo ta bo kiem thu bao mat dang duoc dung cho backend BeautyCare.

## Preconditions

1. MySQL dang chay.
2. Database duoc tao tu `database/beautycare.mysql.sql`.
3. Node.js da cai dat.

## Database Setup

Dung MySQL Workbench, phpMyAdmin, hoac bat ky cong cu MySQL nao de chay schema:

```sql
source database/beautycare.mysql.sql
```

Schema nay se tao database `beautycare`, cac bang auth, booking, payment, audit, va seed du lieu demo.

## Backend Setup

Trong `backend/`:

```bash
copy .env.example .env
npm install
```

Dam bao bien moi truong DB dung voi may cua ban:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=beautycare
DB_USER=root
DB_PASSWORD=
```

## Run Tests

```bash
npm test
```

Bo test hien tai gom:

- `backend/tests/smoke.test.js`
- `backend/tests/security.auth-flow.test.js`
- `backend/tests/security.no-db.test.js`
- `backend/tests/mailer.test.js`

`npm test` se tu dong chay nhom smoke/no-DB, bao gom cookie flags, CSRF, JWT verify/admin middleware, HTTPS redirect guard, CSP, va mailer fallback.

`npm run test:db` dung cho bo end-to-end can MySQL, gom register/login, refresh-token rotation, va 2FA flow.

## What Is Verified

- HttpOnly cookies cho access token va refresh token
- Secure/SameSite/path flags cho auth cookies va CSRF cookie
- CSRF double-submit tren cac request co session cookie
- JWT verify middleware, revoked-token check, va admin authorization
- Refresh token rotation
- 2FA TOTP setup, enable, login, disable
- HTTPS redirect guard khi bat `ENFORCE_HTTPS=true`
- CSP chan inline script
- SMTP delivery va outbox fallback

## Common Failures

### MySQL connection error

Neu gap `ECONNREFUSED` hoac `ER_ACCESS_DENIED_ERROR`:

- Kiem tra MySQL dang chay
- Kiem tra lai `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`

### Missing schema

Neu loi bang nhu `refresh_tokens`, `revoked_tokens`, `email_verify_tokens`:

- Chay lai `database/beautycare.mysql.sql`

### CSRF 403 after login

Neu POST/PUT/DELETE bi 403:

- Lay `csrfToken` moi nhat tu response login/refresh
- Gui len header `X-CSRF-Token`

## Report Checklist

- `npm run lint`
- `npm test`
- `npm run test:perf`
- `npm run audit`
- Screenshot response headers cho CSP va cookies
- Screenshot login, booking, payment, admin flow
