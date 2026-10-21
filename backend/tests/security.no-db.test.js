const request = require('supertest');

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

function findCookie(setCookie, name) {
  return (setCookie || []).find((cookie) => String(cookie).startsWith(`${name}=`));
}

function createCookieApp(env = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };

  const express = require('express');
  const { setAuthCookies, setCsrfCookie } = require('../utils/security');

  const app = express();
  app.get('/issue', (req, res) => {
    setAuthCookies(res, { accessToken: 'access-demo-token', refreshToken: 'refresh-demo-token' });
    setCsrfCookie(res, 'csrf-demo-token');
    res.json({ ok: true });
  });

  return app;
}

function createCsrfApp() {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'unit-test-csrf-secret-012345678901234567890123' };

  const express = require('express');
  const cookieParser = require('cookie-parser');
  const { csrfProtect } = require('../middleware/csrf');
  const { createCsrfToken } = require('../utils/security');

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', csrfProtect);
  app.get('/api/ping', (req, res) => res.json({ ok: true }));
  app.post('/api/mutate', (req, res) => res.json({ ok: true }));

  app.locals.validCsrf = createCsrfToken('refresh:' + require('../utils/security').sha256('refresh-demo'));
  return app;
}

function createAuthMiddlewareApp({ revoked = false } = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'unit-test-secret' };

  const mockRequest = {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockResolvedValue({ recordset: revoked ? [{ id: 1 }] : [] })
  };
  const connect = jest.fn().mockResolvedValue({
    request: () => mockRequest
  });

  jest.doMock('../db', () => ({
    connect,
    sql: {
      NVarChar: jest.fn(() => ({ type: 'nvarchar' }))
    }
  }));

  const express = require('express');
  const cookieParser = require('cookie-parser');
  const jwt = require('jsonwebtoken');
  const { verify, admin, JWT_SECRET } = require('../middleware/auth');

  const app = express();
  app.use(cookieParser());
  app.get('/protected', verify, (req, res) => {
    res.json({ ok: true, user: req.user });
  });
  app.get('/admin', verify, admin, (req, res) => {
    res.json({ ok: true, role: req.user.role });
  });

  return { app, jwt, JWT_SECRET, connect, query: mockRequest.query };
}

function createAppWithEnv(env = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, ...env };
  return require('../app');
}

describe('Security regression checks without DB', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('../db');
    restoreEnv();
  });

  describe('cookie hardening', () => {
    test('issues HttpOnly auth cookies and readable CSRF cookie with strict paths', async () => {
      const app = createCookieApp({
        ACCESS_TOKEN_TTL: '30m',
        REFRESH_TOKEN_TTL: '7d'
      });

      const res = await request(app).get('/issue');
      expect(res.status).toBe(200);

      const setCookie = res.headers['set-cookie'] || [];
      const accessCookie = findCookie(setCookie, 'access_token');
      const refreshCookie = findCookie(setCookie, 'refresh_token');
      const csrfCookie = findCookie(setCookie, 'csrf_token');

      expect(accessCookie).toContain('HttpOnly');
      expect(accessCookie).toContain('SameSite=Lax');
      expect(accessCookie).toContain('Path=/');

      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Strict');
      expect(refreshCookie).toContain('Path=/api/auth');

      expect(csrfCookie).toContain('SameSite=Lax');
      expect(csrfCookie).toContain('Path=/');
      expect(csrfCookie).not.toContain('HttpOnly');
    });

    test('marks cookies Secure when secure-cookie mode is enabled', async () => {
      const app = createCookieApp({ COOKIE_SECURE: 'true' });

      const res = await request(app).get('/issue');
      const setCookie = res.headers['set-cookie'] || [];

      expect(findCookie(setCookie, 'access_token')).toContain('Secure');
      expect(findCookie(setCookie, 'refresh_token')).toContain('Secure');
      expect(findCookie(setCookie, 'csrf_token')).toContain('Secure');
    });
  });

  describe('CSRF middleware', () => {
    test('allows safe GET requests', async () => {
      const app = createCsrfApp();
      const res = await request(app).get('/api/ping');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('allows write requests when no auth cookies are present', async () => {
      const app = createCsrfApp();
      const res = await request(app).post('/api/mutate');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('blocks write requests when auth cookies exist but CSRF header is missing', async () => {
      const app = createCsrfApp();
      const res = await request(app)
        .post('/api/mutate')
        .set('Cookie', ['access_token=abc123', 'csrf_token=csrf-demo-token']);

      expect(res.status).toBe(403);
      expect(String(res.body?.message || '')).toMatch(/csrf/i);
    });

    test('allows write requests when CSRF header matches the cookie', async () => {
      const app = createCsrfApp();
      const res = await request(app)
        .post('/api/mutate')
        .set('Cookie', ['refresh_token=refresh-demo', 'csrf_token=csrf-demo-token'])
        .set('X-CSRF-Token', app.locals.validCsrf)
        .set('Cookie', [`refresh_token=refresh-demo`, `csrf_token=${app.locals.validCsrf}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    test('rejects a valid token copied from another refresh session', async () => {
      const app = createCsrfApp();
      const other = require('../utils/security').createCsrfToken('refresh:' + require('../utils/security').sha256('other-refresh'));
      const res = await request(app)
        .post('/api/mutate')
        .set('Cookie', [`refresh_token=refresh-demo`, `csrf_token=${other}`])
        .set('X-CSRF-Token', other);

      expect(res.status).toBe(403);
    });

    test('rejects a malformed HMAC token even when cookie and header match', async () => {
      const app = createCsrfApp();
      const malformed = 'not-a-csrf-token';
      const res = await request(app)
        .post('/api/mutate')
        .set('Cookie', [`refresh_token=refresh-demo`, `csrf_token=${malformed}`])
        .set('X-CSRF-Token', malformed);

      expect(res.status).toBe(403);
    });

    test('rejects a CSRF header when the CSRF cookie is missing from a session', async () => {
      const app = createCsrfApp();
      const res = await request(app)
        .post('/api/mutate')
        .set('Cookie', ['refresh_token=refresh-demo'])
        .set('X-CSRF-Token', app.locals.validCsrf);

      expect(res.status).toBe(403);
    });
  });

  describe('JWT auth middleware', () => {
    test('rejects requests with no token', async () => {
      const { app, connect } = createAuthMiddlewareApp();
      const res = await request(app).get('/protected');

      expect(res.status).toBe(401);
      expect(connect).not.toHaveBeenCalled();
    });

    test('accepts a valid bearer token and exposes req.user', async () => {
      const { app, jwt, JWT_SECRET, connect, query } = createAuthMiddlewareApp();
      const token = jwt.sign({ id: 9, role: 'user', jti: 'jti-allow' }, JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(
        expect.objectContaining({
          id: 9,
          role: 'user',
          jti: 'jti-allow'
        })
      );
      expect(connect).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledTimes(1);
    });

    test('accepts a valid access token from cookies', async () => {
      const { app, jwt, JWT_SECRET } = createAuthMiddlewareApp();
      const token = jwt.sign({ id: 11, role: 'user', jti: 'cookie-jti' }, JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/protected')
        .set('Cookie', [`access_token=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual(
        expect.objectContaining({
          id: 11,
          role: 'user',
          jti: 'cookie-jti'
        })
      );
    });

    test('rejects revoked tokens', async () => {
      const { app, jwt, JWT_SECRET } = createAuthMiddlewareApp({ revoked: true });
      const token = jwt.sign({ id: 15, role: 'user', jti: 'revoked-jti' }, JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(String(res.body?.message || '')).toMatch(/thu/i);
    });

    test('blocks non-admin users from admin routes', async () => {
      const { app, jwt, JWT_SECRET } = createAuthMiddlewareApp();
      const token = jwt.sign({ id: 20, role: 'user', jti: 'user-jti' }, JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    test('allows admin users through admin middleware', async () => {
      const { app, jwt, JWT_SECRET } = createAuthMiddlewareApp();
      const token = jwt.sign({ id: 21, role: 'admin', jti: 'admin-jti' }, JWT_SECRET, { expiresIn: '1h' });

      const res = await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, role: 'admin' });
    });
  });

  describe('app-level transport guard', () => {
    test('enforces the default API rate limit outside performance mode', async () => {
      const app = createAppWithEnv({ PERF_TEST: 'false', NODE_ENV: 'test', PUBLIC_APP_URL: 'http://127.0.0.1:3000' });
      const responses = await Promise.all(
        Array.from({ length: 305 }, () => request(app).get('/api/health'))
      );

      expect(responses.some((res) => res.status === 429)).toBe(true);
    });

    test('raises only the local performance-test threshold', async () => {
      const app = createAppWithEnv({ PERF_TEST: 'true', NODE_ENV: 'test', PUBLIC_APP_URL: 'http://127.0.0.1:3000' });
      const responses = await Promise.all(
        Array.from({ length: 305 }, () => request(app).get('/api/health'))
      );

      expect(responses.every((res) => res.status === 200)).toBe(true);
    });

    test('does not enable performance mode in production', async () => {
      const app = createAppWithEnv({
        PERF_TEST: 'true',
        NODE_ENV: 'production',
        TRUST_PROXY: '1',
        PUBLIC_APP_URL: 'http://127.0.0.1:3000'
      });
      const responses = await Promise.all(
        Array.from({ length: 305 }, () => request(app).get('/api/health').set('X-Forwarded-Proto', 'https'))
      );

      expect(responses.some((res) => res.status === 429)).toBe(true);
    });

    test('redirects to HTTPS when ENFORCE_HTTPS is enabled', async () => {
      const app = createAppWithEnv({ ENFORCE_HTTPS: 'true' });
      const res = await request(app)
        .get('/api/health')
        .set('Host', 'beautycare.local');

      expect(res.status).toBe(308);
      expect(res.headers.location).toBe('https://beautycare.local/api/health');
    });

    test('does not trust a forged forwarded HTTPS header without configured proxy trust', async () => {
      const app = createAppWithEnv({ ENFORCE_HTTPS: 'true', TRUST_PROXY: 'false' });
      const res = await request(app)
        .get('/api/health')
        .set('Host', 'beautycare.local')
        .set('X-Forwarded-Proto', 'https');

      expect(res.status).toBe(308);
      expect(res.headers.location).toBe('https://beautycare.local/api/health');
    });

    test('accepts HTTPS forwarded by an explicitly trusted proxy and emits HSTS', async () => {
      const app = createAppWithEnv({
        NODE_ENV: 'production',
        HTTPS: 'false',
        ENFORCE_HTTPS: 'true',
        TRUST_PROXY: '1',
        CORS_ORIGINS: 'https://app.beautycare.example'
      });
      const res = await request(app)
        .get('/api/health')
        .set('Host', 'api.beautycare.example')
        .set('X-Forwarded-Proto', 'https')
        .set('Origin', 'https://app.beautycare.example');

      expect(res.status).toBe(200);
      expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
      expect(res.headers['access-control-allow-origin']).toBe('https://app.beautycare.example');
      expect(String(res.headers['content-security-policy'] || '')).toContain('upgrade-insecure-requests');
    });

    test('fails closed for a production origin outside the explicit CORS allowlist', async () => {
      const app = createAppWithEnv({
        NODE_ENV: 'production',
        HTTPS: 'false',
        ENFORCE_HTTPS: 'true',
        TRUST_PROXY: '1',
        CORS_ORIGINS: 'https://app.beautycare.example'
      });
      const res = await request(app)
        .get('/api/health')
        .set('Host', 'api.beautycare.example')
        .set('X-Forwarded-Proto', 'https')
        .set('Origin', 'https://untrusted.example');

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/CORS blocked/i);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
