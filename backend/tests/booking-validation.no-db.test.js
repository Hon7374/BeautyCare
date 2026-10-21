const request = require('supertest');
const express = require('express');

jest.mock('../middleware/auth', () => ({
  verify: (req, _res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  }
}));

const bookingsRouter = require('../routes/bookings');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingsRouter);
  return app;
}

describe('Booking input validation', () => {
  test('rejects a missing service identifier before opening a database connection', async () => {
    const response = await request(makeApp()).post('/api/bookings').send({ date: '2099-12-31', time: '09:00' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/serviceId/i);
  });

  test('rejects malformed and past dates', async () => {
    const app = makeApp();
    const malformed = await request(app).post('/api/bookings').send({ serviceId: 1, date: '31-12-2099', time: '09:00' });
    const past = await request(app).post('/api/bookings').send({ serviceId: 1, date: '2000-01-01', time: '09:00' });
    expect(malformed.status).toBe(400);
    expect(past.status).toBe(400);
  });

  test('rejects malformed times and times outside the published slot grid', async () => {
    const app = makeApp();
    const malformed = await request(app).post('/api/bookings').send({ serviceId: 1, date: '2099-12-31', time: '25:00' });
    const outsideGrid = await request(app).post('/api/bookings').send({ serviceId: 1, date: '2099-12-31', time: '09:15' });
    expect(malformed.status).toBe(400);
    expect(outsideGrid.status).toBe(400);
  });

  test('rejects a time after the closing boundary', async () => {
    const response = await request(makeApp()).post('/api/bookings').send({ serviceId: 1, date: '2099-12-31', time: '19:30' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/phép|cho phép|grid/i);
  });

  test('rejects a calendar range whose end precedes its start', async () => {
    const response = await request(makeApp()).get('/api/bookings/availability-calendar')
      .query({ serviceId: 1, from: '2099-12-31', to: '2099-12-01' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/to/i);
  });

  test('rejects an availability calendar range longer than the bounded query window', async () => {
    const response = await request(makeApp()).get('/api/bookings/availability-calendar')
      .query({ serviceId: 1, from: '2099-01-01', to: '2099-04-01' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/62/i);
  });
});
