/*
  Security/Auth flow integration tests

  These tests verify that the "security" module really runs end-to-end:
  - Cookies (HttpOnly) are issued on register/login
  - CSRF (double-submit) is enforced once a session cookie exists
  - Refresh token rotation works (and is blocked without CSRF)
  - 2FA TOTP setup/enable/login/disable works

  REQUIREMENT:
  - A running MySQL server with the schema from /database/beautycare.mysql.sql
  - Environment variables DB_* must point to that database (or defaults are used).

  Run:
    cd backend
    npm run test:db
*/

const request = require('supertest');
const speakeasy = require('speakeasy');

const app = require('../app');
const db = require('../db');

function randDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += String(Math.floor(Math.random() * 10));
  return s;
}

describe('Security/Auth: cookies + CSRF + refresh rotation + 2FA', () => {
  const agent = request.agent(app);

  // We create a unique user to keep tests re-runnable.
  const phone = `09${randDigits(8)}`; // VN-like 10 digits
  const email = `test.${Date.now()}@example.com`;
  const password = 'Abcd1234X';

  let csrfToken = null;
  let twofaSecret = null;

  afterAll(async () => {
    // Best-effort cleanup to avoid leaving many test accounts.
    try {
      const pool = await db.connect();
      const rs = await pool
        .request()
        .input('phone', db.sql.NVarChar, phone)
        .query('SELECT TOP (1) id FROM users WHERE phone=@phone');

      if (rs.recordset.length) {
        const userId = rs.recordset[0].id;

        // Delete dependent rows first
        await pool.request().input('uid', db.sql.Int, userId).query('DELETE FROM refresh_tokens WHERE user_id=@uid');
        await pool.request().input('uid', db.sql.Int, userId).query('DELETE FROM password_reset_tokens WHERE user_id=@uid');
        await pool.request().input('uid', db.sql.Int, userId).query('DELETE FROM email_verify_tokens WHERE user_id=@uid');
        await pool.request().input('uid', db.sql.Int, userId).query('DELETE FROM audit_logs WHERE actor_user_id=@uid');
        await pool.request().input('uid', db.sql.Int, userId).query('DELETE FROM revoked_tokens WHERE user_id=@uid');

        // Finally, delete user
        await pool.request().input('uid', db.sql.Int, userId).query('DELETE FROM users WHERE id=@uid');
      }
    } catch (e) {
      // Do not fail the suite if cleanup fails (DB permissions/table missing in older schema).
      // eslint-disable-next-line no-console
      console.warn('⚠️ cleanup skipped/failed:', e?.message || e);
    } finally {
      await db.close();
    }
  });

  test('Register issues cookies (access/refresh/csrf) and returns csrfToken', async () => {
    const res = await agent.post('/api/auth/register').send({
      name: 'Test User',
      phone,
      email,
      password
    });

    expect(res.status).toBe(201);
    expect(res.body?.user?.phone).toBe(phone);
    expect(res.body?.csrfToken).toBeTruthy();

    csrfToken = res.body.csrfToken;
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => String(c).includes('access_token='))).toBe(true);
    expect(setCookie.some((c) => String(c).includes('refresh_token='))).toBe(true);
    expect(setCookie.some((c) => String(c).includes('csrf_token='))).toBe(true);
  });

  test('CSRF blocks POST /api/auth/refresh if session cookie exists but header missing', async () => {
    const res = await agent.post('/api/auth/refresh');
    expect(res.status).toBe(403);
    expect(String(res.body?.message || '')).toMatch(/CSRF/i);
  });

  test('Refresh succeeds with correct CSRF header and rotates csrf token', async () => {
    const res = await agent.post('/api/auth/refresh').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.csrfToken).toBeTruthy();
    csrfToken = res.body.csrfToken;

    // Should set a new refresh_token cookie (rotation)
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => String(c).includes('refresh_token='))).toBe(true);
  });

  test('2FA setup -> enable -> logout', async () => {
    const setup = await agent.post('/api/auth/2fa/setup').set('X-CSRF-Token', csrfToken);
    expect(setup.status).toBe(200);
    expect(setup.body?.ok).toBe(true);
    expect(setup.body?.secret).toBeTruthy();
    twofaSecret = setup.body.secret;

    const otp = speakeasy.totp({ secret: twofaSecret, encoding: 'base32' });
    const enable = await agent.post('/api/auth/2fa/enable').set('X-CSRF-Token', csrfToken).send({ otp });
    expect(enable.status).toBe(200);
    expect(enable.body?.ok).toBe(true);

    const logout = await agent.post('/api/auth/logout').set('X-CSRF-Token', csrfToken);
    expect(logout.status).toBe(200);
    expect(logout.body?.ok).toBe(true);
  });

  test('After enabling 2FA: login requires otp; login with otp works; then disable 2FA', async () => {
    // new agent to avoid cookies from previous session
    const a = request.agent(app);

    const noOtp = await a.post('/api/auth/login').send({ email, password });
    expect(noOtp.status).toBe(401);
    expect(noOtp.body?.code).toBe('TWO_FA_REQUIRED');

    const otp = speakeasy.totp({ secret: twofaSecret, encoding: 'base32' });
    const okLogin = await a.post('/api/auth/login').send({ email, password, otp });
    expect(okLogin.status).toBe(200);
    expect(okLogin.body?.user?.email).toBe(email);
    expect(okLogin.body?.csrfToken).toBeTruthy();
    const csrf = okLogin.body.csrfToken;

    const otp2 = speakeasy.totp({ secret: twofaSecret, encoding: 'base32' });
    const disable = await a.post('/api/auth/2fa/disable').set('X-CSRF-Token', csrf).send({ otp: otp2 });
    expect(disable.status).toBe(200);
    expect(disable.body?.ok).toBe(true);
  });
});
