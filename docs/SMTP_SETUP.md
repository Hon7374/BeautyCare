# SMTP Setup

BeautyCare uses SMTP for real email delivery and keeps `backend/outbox/` as a demo-safe fallback when `EMAIL_FALLBACK_TO_OUTBOX=true`.

## Gmail SMTP environment

Set these variables in `backend/.env`:

```env
EMAIL_DELIVERY_MODE=smtp
EMAIL_FALLBACK_TO_OUTBOX=true

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=khucmai51@gmail.com
SMTP_PASSWORD=
SMTP_FROM=khucmai51@gmail.com
SMTP_FROM_NAME=BeautyCare
SMTP_REPLY_TO=khucmai51@gmail.com
SMTP_REQUIRE_TLS=true
SMTP_IGNORE_TLS=false
SMTP_TLS_REJECT_UNAUTHORIZED=true
SMTP_POOL=true

ADMIN_NOTIFICATION_EMAILS=khucmai51@gmail.com
```

`SMTP_PASSWORD` must be a Gmail App Password, not the normal Gmail login password. Gmail App Passwords are typically 16 characters; you can paste them with or without spaces.
If `SMTP_PASSWORD` is empty, BeautyCare treats SMTP as not ready and writes the email into `backend/outbox/` when fallback is enabled.

For Gmail:

1. Enable 2-Step Verification on `khucmai51@gmail.com`.
2. Create an App Password for Mail.
3. Paste that App Password into `SMTP_PASSWORD` in `backend/.env`.
4. Restart the backend.

## Delivery rules

- Verify email:
  - sender: `khucmai51@gmail.com`
  - recipient: the current user's own `users.email`
  - never uses `ADMIN_NOTIFICATION_EMAILS`
- Booking notification:
  - sender: `khucmai51@gmail.com`
  - recipients: `ADMIN_NOTIFICATION_EMAILS`
  - sent after `POST /api/bookings` creates a booking successfully
- Password reset still uses the same SMTP sender and the requesting account email.

## Verification

1. Start the backend after setting `SMTP_PASSWORD`, then run `npm run smtp:verify`. This makes a real SMTP connection and authenticates without sending a message.
2. Set `SMTP_TEST_TO` to a mailbox you control and run `npm run smtp:send-test`. Record only the result/message ID; never record the app password.
3. Log in as a user with a real email, then call `POST /api/auth/request-verify-email` and confirm delivery to that user's mailbox.
4. Exercise `POST /api/auth/forgot-password` for the same kind of account and confirm delivery of the reset link.
5. Create a booking using `POST /api/bookings`. The system now sends two messages: an internal notification to `ADMIN_NOTIFICATION_EMAILS` and a privacy-minimised confirmation to the customer's `users.email`.
6. Temporarily break `SMTP_PASSWORD`; with `EMAIL_FALLBACK_TO_OUTBOX=true`, the main business request still succeeds and a message appears under `backend/outbox/`.

The automated suite includes a local SMTP protocol integration test and booking-confirmation tests. It validates Nodemailer's SMTP transport without making a network call or sending an email externally; the commands above provide the required real-provider evidence.
