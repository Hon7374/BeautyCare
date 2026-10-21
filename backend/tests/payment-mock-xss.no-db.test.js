const request = require('supertest');
const express = require('express');

describe('Mock payment HTML escaping', () => {
  function makeApp() {
    jest.resetModules();
    const paymentsRouter = require('../routes/payments');
    const app = express();
    app.use('/api/payments', paymentsRouter);
    return app;
  }

  test('escapes HTML text and rejects executable markup from ref', async () => {
    const res = await request(makeApp()).get('/api/payments/mock/pay')
      .query({
        ref: '<script>alert(1)</script> & "quoted"',
        provider: 'vnpay',
        front: 'http://localhost:3000/user'
      });

    expect(res.status).toBe(200);
    expect(res.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(res.text).toContain('&amp; &quot;quoted&quot;');
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).not.toMatch(/<img|onerror\s*=|javascript:/i);
  });

  test('keeps URL attributes on an allowlisted HTTP origin and rejects javascript schemes', async () => {
    const safe = await request(makeApp()).get('/api/payments/mock/pay')
      .query({ ref: 'safe-ref', provider: 'vnpay', front: 'http://localhost:3000/user' });
    const unsafe = await request(makeApp()).get('/api/payments/mock/pay')
      .query({ ref: 'safe-ref', provider: 'vnpay', front: 'javascript:alert(1)' });

    expect(safe.status).toBe(200);
    expect(safe.text).toMatch(/href="\/api\/payments\/mock\/complete\?ref=safe-ref[^" ]*front=http%3A%2F%2Flocalhost%3A3000%2Fuser/);
    expect(unsafe.status).toBe(200);
    expect(unsafe.text).not.toMatch(/javascript:/i);
    expect(unsafe.text).toMatch(/href="\/api\/payments\/mock\/complete\?ref=safe-ref[^" ]*front=http%3A%2F%2Flocalhost%3A3000/);
  });

  test('escapes HTML in an allowlisted frontend URL pathname', async () => {
    const res = await request(makeApp()).get('/api/payments/mock/pay')
      .query({
        ref: 'safe-ref',
        provider: 'mock',
        front: 'http://localhost:3000/<img src=x onerror=alert(1)>'
      });

    expect(res.status).toBe(200);
    expect(res.text).toContain('http://localhost:3000/%3Cimg%20src=x%20onerror=alert(1)%3E');
    expect(res.text).not.toMatch(/<img\b|<script\b|javascript:/i);
    expect(res.text).not.toMatch(/<[^>]*\bonerror\s*=/i);
  });

  test('sanitizes provider display and encoded/event-handler payloads', async () => {
    const res = await request(makeApp()).get('/api/payments/mock/pay')
      .query({
        ref: '%3Csvg%20onload%3Dalert(1)%3E',
        provider: '"><img src=x onerror=alert(1)>',
        front: 'http://127.0.0.1:3000/user'
      });

    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/<svg|<img|onload\s*=|onerror\s*=|javascript:/i);
    expect(res.text).toContain('%3Csvg%20onload%3Dalert(1)%3E');
  });

  test('requires a non-empty reference', async () => {
    const res = await request(makeApp()).get('/api/payments/mock/pay').query({ ref: '' });
    expect(res.status).toBe(400);
  });
});
