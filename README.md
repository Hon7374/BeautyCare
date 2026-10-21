# BeautyCare Demo

BeautyCare is a thesis-aligned prototype for a secure beauty-service web system.

Current scope kept for the report/demo:

- beauty-service website with static HTML/CSS/JS frontend
- account management with token auth, refresh rotation, CSRF and 2FA
- service browsing and booking
- service payment with demo-safe mock gateway support
- voucher, membership and loyalty flows
- admin pages for users, services, bookings, transactions and subscriptions

## Official Architecture

The official demo architecture is:

- `frontend/` = main frontend, plain static HTML/CSS/JS
- `backend/` = Express API + static file server
- `database/beautycare.mysql.sql` = MySQL schema + seed data

The unfinished React/JSX SPA was moved to:

- `frontend/_quarantine/react-spa/`

It is not part of the official demo runbook.

## Cách chạy demo

Use this exact flow for the thesis demo:

1. Install MySQL locally.
2. Import `database/beautycare.mysql.sql`.
3. Go to `backend/`.
4. Run `npm install`.
5. Copy `.env.example` to `.env` if needed.
6. Check the demo-safe defaults in `.env`:
   - `PAYMENTS_MODE=mock`
   - `EMAIL_DELIVERY_MODE=outbox`
   - `FRONTEND_URL=http://localhost:3000`
7. Run `node server.js`.
8. Open `http://localhost:3000`.

Notes:

- Do not use Live Server as the primary demo path.
- The backend already serves the static frontend from `frontend/`.
- In demo mode, payment redirects stay inside the mock payment flow unless you explicitly switch `PAYMENTS_MODE=real`.
- Email actions go to outbox by default unless you explicitly configure SMTP.

## Demo Configuration

Recommended `backend/.env` values for thesis demo:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=beautycare
DB_USER=root
DB_PASSWORD=

FRONTEND_URL=http://localhost:3000
PUBLIC_APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500

AUTH_DEMO_MODE=false
EMAIL_DELIVERY_MODE=outbox
EMAIL_FALLBACK_TO_OUTBOX=true
PAYMENTS_MODE=mock
```

## Test Commands

Run inside `backend/`:

```bash
npm run lint
npm test
npm run test:db
npm run test:all
npm run test:perf
```

Meaning of each command:

- `npm test`: smoke/unit suites first; DB integration/security suite runs only if MySQL is reachable. If MySQL is missing, the command prints a skip notice instead of pretending full coverage passed.
- `npm run test:db`: DB-backed integration/security suite only. Requires imported MySQL schema and a valid `backend/.env`.
- `npm run test:all`: smoke/unit + DB-backed suite, and fails if MySQL is unavailable.
- `npm run test:perf`: lightweight in-process performance smoke for report evidence.

## Important Limitations

- MySQL is the practical runtime used in this repository, even though the theory/report may compare MySQL, MariaDB and PostgreSQL.
- The static frontend is the official demo frontend. The quarantined React SPA is incomplete and should not be presented as the main implementation.
- `PAYMENTS_MODE=mock` is the default for demo safety. Real gateway credentials are optional and should only be enabled deliberately.
- `EMAIL_DELIVERY_MODE=outbox` is the default for demo safety. SMTP is optional.
- Some backend routes are intentionally demo-friendly and may degrade gracefully if auxiliary tables or services are missing, but the official evaluation flow still assumes the MySQL schema has been imported.

## Related Docs

- [Deployment Notes](docs/DEPLOYMENT.md)
- [Report Evidence](docs/REPORT_EVIDENCE.md)
- [Research Alignment](docs/RESEARCH_ALIGNMENT.md)
- [Business Analysis](docs/BUSINESS_ANALYSIS.md)
- [Agile Scrum Alignment](docs/AGILE_SCRUM.md)
