const request = require('supertest');
const app = require('../app');
const db = require('../db');

// These smoke checks must stay DB-independent.
describe('Smoke tests', () => {
  afterAll(async () => {
    await db.close();
  });

  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /api/auth/csrf sets csrf cookie', async () => {
    const res = await request(app).get('/api/auth/csrf');
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeTruthy();
    const setCookie = res.headers['set-cookie'] || [];
    const hasCsrf = setCookie.some((c) => String(c).includes('csrf_token='));
    expect(hasCsrf).toBe(true);
  });

  test('GET / includes CSP header that blocks inline scripts', async () => {
    const res = await request(app).get('/').set('Accept', 'text/html');
    expect(res.status).toBe(200);
    const csp = String(res.headers['content-security-policy'] || '');
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/i);
  });
});
