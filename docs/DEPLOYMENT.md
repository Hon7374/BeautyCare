# Deployment Notes

## Official Demo Topology

For the thesis demo, the backend is the only server you need to run:

- MySQL provides the application data
- `node backend/server.js` serves both the API and the static frontend
- the browser opens `http://localhost:3000`

Recommended demo flow:

1. Import `database/beautycare.mysql.sql`
2. Configure `backend/.env`
3. Run `node server.js` in `backend/`
4. Open `http://localhost:3000`

## Demo-Safe Environment Defaults

Use these values unless you intentionally switch to real integrations:

```env
FRONTEND_URL=http://localhost:3000
PUBLIC_APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500

PAYMENTS_MODE=mock
EMAIL_DELIVERY_MODE=outbox
EMAIL_FALLBACK_TO_OUTBOX=true
```

Why:

- `PAYMENTS_MODE=mock` prevents accidental redirects to real payment gateways during demo
- `EMAIL_DELIVERY_MODE=outbox` keeps recovery/verification flows usable without SMTP
- `FRONTEND_URL=http://localhost:3000` keeps payment return URLs aligned with the official static frontend

## HTTPS

HTTPS is optional for local demo and controlled by:

```env
HTTPS=false
ENFORCE_HTTPS=false
STRICT_HTTPS=false
SSL_KEY_PATH=./certs/localhost.key
SSL_CERT_PATH=./certs/localhost.crt
COOKIE_SECURE=false
```

If you want a local HTTPS demo:

1. Generate local certs with `backend/scripts/gen-cert.ps1` or `backend/scripts/gen-cert.sh`
2. Set `HTTPS=true`
3. Set `SSL_KEY_PATH` and `SSL_CERT_PATH`
4. If running fully on HTTPS, also set `COOKIE_SECURE=true`

If `STRICT_HTTPS=true` and cert files are missing, the backend should refuse to start.

## Current CSP / Security Header Notes

Current CSP is defined in `backend/app.js`.

Important current behavior:

- `script-src 'self'`
- inline scripts are blocked
- inline styles are still allowed because the static demo pages use them
- Google Fonts and `fonts.gstatic.com` are allowed
- images from `https:` and `data:` are allowed
- `connect-src` allows same-origin plus local `localhost` development origins
- `crossOriginResourcePolicy` is disabled to avoid breaking frontend asset loading in demo

This document replaces the older CSP note that implied the app still allowed inline scripts by default.

## Static Frontend Routing

The backend serves files from `frontend/` directly:

- `/` -> `frontend/index.html`
- `/login.html`
- `/register.html`
- `/forgot.html`
- `/reset.html`
- `/user/*.html`
- `/admin/*.html`

Unknown non-API HTML navigations fall back to `frontend/index.html`.

## Payment Return Behavior

Payment return URLs must resolve back to the static frontend.

Current design:

- default return base is `PUBLIC_APP_URL` / `FRONTEND_URL`
- in demo mode, mock payment pages redirect back to `/user/payment-result.html`
- real gateway return handlers also normalize redirects against the configured frontend host allowlist

## Email Behavior

Current design:

- default mode is `outbox`
- SMTP is opt-in
- if SMTP is enabled and fails, outbox fallback can still be used when `EMAIL_FALLBACK_TO_OUTBOX=true`

This keeps forgot-password and verify-email flows demonstrable even without a mail server.

## Operational Limits

- Import the MySQL schema before presenting the full demo
- `npm run test:db` and `npm run test:all` require MySQL
- the quarantined React SPA in `frontend/_quarantine/react-spa/` is not deployed and should not be presented as production/demo UI
