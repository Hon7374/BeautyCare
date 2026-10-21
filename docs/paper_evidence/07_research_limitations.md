# Research limitations

1. The current audit is source/artifact based. No new database-backed test, browser test, ZAP scan, sandbox payment, or load test was run on 2026-10-17.
2. Historical environment data cannot be assumed to describe the current host, dependency installation, database, or configuration.
3. The k6 scenario exercises only unauthenticated `GET /api/services`, so it cannot support claims about full checkout or security workload capacity.
4. The repository lacks usable Git metadata in the current workspace, limiting change provenance.
5. CSRF protection is not cryptographically signed and is not session-bound according to the audited source.
6. Voucher expiry is supported, but usage limits, per-customer limits, minimum order values, future activation dates, atomic consumption, and idempotency were not found.
7. Historical test evidence uses isolated MySQL instances, but the current `.env` was not used for a new run and no secret values are included here.
8. ZAP warnings remain material: the retained report records 4 Medium, 2 Low, and 3 Informational alert types, not zero findings.

