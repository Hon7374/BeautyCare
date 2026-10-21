# Research Alignment

This project is positioned as a secure web commerce prototype for beauty-care services with CRM and loyalty features, not as a generic all-purpose ecommerce platform.

## 1) Database scope

- Theory/research scope: MySQL, MariaDB, PostgreSQL.
- Experimental implementation in this repository: MySQL (`mysql2`, `database/beautycare.mysql.sql`).
- Recommended report wording: present the DBMS comparison in the theory chapter, then state that the practical prototype was implemented on MySQL for the experiment phase.

## 2) Product scope

- Domain: beauty-care and service commerce.
- Core flows: secure account management, token auth, CRM/loyalty, booking, service checkout, online payment, admin control.
- Suitable claim: "secure ecommerce web system for beauty-care services" or "secure CRM/loyalty service-commerce prototype".

## 3) Security posture after this update

- Inline scripts are blocked by CSP.
- Auth recovery and email verification no longer expose tokens by default.
- Tokens are only returned directly when `AUTH_DEMO_MODE=true`.
- Recovery and verification emails support SMTP delivery.
- If SMTP is not configured or fails, messages fall back to `backend/outbox/`.
- HTTPS can now be enforced explicitly with `ENFORCE_HTTPS=true`.
- Startup can fail closed with `STRICT_HTTPS=true` when certificates are missing.

## 4) Payments

- Real integrations: VNPay, MoMo, Stripe.
- Optional demo path: `PAYMENTS_MODE=mock`.
- In the report, present mock mode as a controlled experimental fallback, not the default production claim.

## 5) Recommended report phrasing

Use this structure to avoid mismatch questions from reviewers:

1. Theory chapter: survey security controls and DBMS characteristics for MySQL, MariaDB, PostgreSQL.
2. Experimental chapter: implement and validate the prototype on MySQL.
3. Scope statement: secure web commerce for beauty-care services with booking and payment workflows.
