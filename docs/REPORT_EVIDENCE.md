# Report Evidence Checklist

Use this file to collect evidence for the experimental chapter and appendix.

## Test Layers

The repository now separates automated tests by dependency:

- smoke/unit: no MySQL required
- integration/security: MySQL required
- performance smoke: no MySQL required

Do not report `npm test` as full DB-backed coverage unless the output explicitly shows that the DB suite also ran.

## Commands

Run inside `backend/`:

```bash
npm run lint
npm test
npm run test:db
npm run test:all
npm run test:perf
```

How to interpret the commands:

- `npm test`
  - always runs smoke/unit suites first
  - runs DB integration/security only when MySQL is reachable
  - prints a skip notice when MySQL is missing
- `npm run test:db`
  - runs only the DB-backed integration/security suite
  - fails if MySQL is not reachable
- `npm run test:all`
  - requires MySQL
  - intended for a full report run
- `npm run test:perf`
  - lightweight in-process timing evidence

## Current Documentation-Safe Status

Use the table below instead of claiming blanket success:

| Command | Requires MySQL | What it proves | Report wording |
| --- | --- | --- | --- |
| `npm run lint` | No | static code quality pass/fail | Safe to mark pass only after rerun |
| `npm test` | No for smoke/unit, Yes for DB suite | smoke/unit always, DB only when available | Mention whether DB suite ran or was skipped |
| `npm run test:db` | Yes | auth/security integration with cookies, CSRF, refresh rotation, 2FA | Do not mark pass without imported MySQL |
| `npm run test:all` | Yes | full automated pass for this repository | Use this for final appendix evidence |
| `npm run test:perf` | No | lightweight response-time evidence | Not a full load test |

## Recommended Evidence Capture Order

1. Import `database/beautycare.mysql.sql`
2. Start backend with demo-safe `.env`
3. Capture `npm run lint`
4. Capture `npm run test:all`
5. Capture `npm run test:perf`
6. Capture browser screenshots for user and admin flows

## Recorded independent-MySQL run (2026-08-20)

The full suite was executed against a newly initialised MySQL 8 instance on `127.0.0.1:3411`, separate from the developer's configured database. `database/beautycare.mysql.sql` was imported before the run; schema verification returned 17 tables and 11 seeded users. Environment-only overrides pointed `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` to that instance.

```text
npm run test:all
Test Suites: 9 passed, 9 total
Tests:       38 passed, 38 total
Snapshots:   0 total
```

The result includes the DB-backed auth/security suite (register, CSRF rejection, refresh-token rotation, 2FA setup/enable/login/disable), no-DB security regressions, SMTP transport integration and booking email tests. This is automated evidence; it is not evidence of a live Stripe charge or email arriving in an external inbox. Record those separately using `docs/PAYMENTS_SETUP.md` and `docs/SMTP_SETUP.md`.

## Browser Flow Checklist

### User-side evidence

- `login.html`: successful login
- `register.html`: successful registration
- `forgot.html` / `reset.html`: recovery flow using outbox or demo token path
- `user/services.html`: service list renders correctly
- `user/booking.html`: booking creation works
- `user/payment.html`: mock payment flow works
- `user/payment-result.html`: payment result is shown correctly
- `user/history.html`: transaction history is shown
- `user/profile.html`: profile update works
- `user/security.html`: password / verify email / 2FA actions work
- `user/membership.html`: membership purchase flow works

### Admin-side evidence

- `admin/users.html`
- `admin/services.html`
- `admin/bookings.html`
- `admin/transactions.html`
- `admin/discounts.html`
- `admin/subscriptions.html`
- `admin/reports.html`
- `admin/vouchers.html`

## Security Evidence Checklist

Use `backend/tests/security.auth-flow.test.js` plus browser screenshots:

- HttpOnly login/refresh cookies issued
- CSRF rejection without `X-CSRF-Token`
- refresh token rotation works
- 2FA enable/login/disable works
- role-protected admin pages redirect correctly

## Performance Evidence Checklist

Use `npm run test:perf` and record the console table:

- `GET /api/health`
- `GET /api/auth/csrf`
- `GET /`

State clearly in the report:

- this is an in-process smoke measurement
- it is not a distributed or production load test

## Demo / Research Limits To State Explicitly

- official frontend is the static HTML/CSS/JS frontend served by the backend
- quarantined React SPA is not part of the evaluated demo
- practical runtime DB is MySQL
- payment demo defaults to mock mode
- email demo defaults to outbox mode
- DB-backed automation depends on imported MySQL schema and valid `backend/.env`
