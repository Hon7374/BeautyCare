const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  verify: (req, _res, next) => {
    req.user = { id: 1, role: 'user' };
    next();
  }
}));

jest.mock('../utils/bookingMailer', () => ({
  sendBookingCreatedNotification: jest.fn().mockResolvedValue({ mode: 'test' }),
  sendBookingConfirmationEmail: jest.fn().mockResolvedValue({ mode: 'test' })
}));

const express = require('express');
process.env.BOOKING_CAPACITY = '3';
const db = require('../db');
const bookingsRouter = require('../routes/bookings');

describe('Booking slot concurrency (isolated MySQL)', () => {
  const date = '2099-12-31';
  const time = '09:00';
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingsRouter);

  let available = false;

  beforeAll(async () => {
    try {
      await db.connect();
      available = true;
      const pool = await db.connect();
      await pool.request()
        .input('d', db.sql.VarChar(10), date)
        .input('t', db.sql.VarChar(8), '09:00:00')
        .query('DELETE FROM bookings WHERE booking_date=CAST(@d AS date) AND booking_time=CAST(@t AS time(0))');
    } catch (_) {
      available = false;
    }
  });

  afterAll(async () => {
    if (available) {
      const pool = await db.connect();
      await pool.request()
        .input('d', db.sql.VarChar(10), date)
        .input('t', db.sql.VarChar(8), '09:00:00')
        .query('DELETE FROM bookings WHERE booking_date=CAST(@d AS date) AND booking_time=CAST(@t AS time(0))');
    }
    await db.close();
  });

  test('accepts at most configured capacity and rejects the remainder', async () => {
    if (!available) return;
    const responses = await Promise.all(
      Array.from({ length: 50 }, () => request(app).post('/api/bookings').send({ serviceId: 1, date, time }))
    );
    const statusCounts = responses.reduce((acc, response) => {
      acc[response.status] = (acc[response.status] || 0) + 1;
      return acc;
    }, {});
    const pool = await db.connect();
    const rows = await pool.request()
      .input('d', db.sql.VarChar(10), date)
      .input('t', db.sql.VarChar(8), '09:00:00')
      .query("SELECT COUNT(*) AS c FROM bookings WHERE booking_date=CAST(@d AS date) AND booking_time=CAST(@t AS time(0)) AND status IN ('pending','confirmed','paid')");

    expect(statusCounts[201]).toBe(3);
    expect(statusCounts[409]).toBe(47);
    expect(Number(rows.recordset[0].c)).toBe(3);
  }, 30000);
});
