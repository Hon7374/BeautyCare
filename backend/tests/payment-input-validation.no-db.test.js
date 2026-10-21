const request = require('supertest');
const express = require('express');

jest.mock('../middleware/auth', () => ({
  verify: (req, _res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  }
}));

const paymentsRouter = require('../routes/payments');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);
  return app;
}

describe('Payment input validation', () => {
  test('rejects an unsupported checkout provider before database work', async () => {
    const response = await request(makeApp()).post('/api/payments/checkout').send({ provider: 'unknown-provider', serviceId: 1 });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/provider/i);
  });

  test('rejects checkout without a service identifier', async () => {
    const response = await request(makeApp()).post('/api/payments/checkout').send({ provider: 'cash' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/serviceId/i);
  });
});
