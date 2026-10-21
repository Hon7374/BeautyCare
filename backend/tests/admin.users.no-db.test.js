const express = require('express');
const request = require('supertest');

function createDbMock(queryImpl) {
  return {
    connect: jest.fn().mockResolvedValue({
      request() {
        const params = new Map();
        return {
          input(name, type, value) {
            if (arguments.length === 2) value = type;
            params.set(String(name), value);
            return this;
          },
          query(sql) {
            return Promise.resolve(queryImpl(String(sql), params));
          }
        };
      }
    }),
    sql: {
      Int: { type: 'int' },
      Bit: { type: 'bit' },
      DateTime: { type: 'datetime' },
      NVarChar() {
        return { type: 'nvarchar' };
      }
    }
  };
}

function createApp(queryImpl, requester = { id: 1, role: 'admin' }) {
  jest.resetModules();
  jest.doMock('../db', () => createDbMock(queryImpl));
  jest.doMock('../middleware/auth', () => ({
    verify(req, res, next) {
      req.user = { ...requester };
      next();
    },
    admin(req, res, next) {
      next();
    }
  }));
  jest.doMock('../utils/audit', () => ({
    audit: jest.fn().mockResolvedValue()
  }));
  jest.doMock('../utils/serviceModel', () => ({
    SERVICE_SELECT_FIELDS: 'id',
    ensureServiceSchema: jest.fn().mockResolvedValue(),
    normalizeService: jest.fn((value) => value),
    normalizeServiceInput: jest.fn((value) => value),
    validateServiceInput: jest.fn(() => null),
    bindServiceInput: jest.fn(() => ({
      query: jest.fn().mockResolvedValue({ recordset: [{ id: 1 }] })
    }))
  }));
  jest.doMock('../utils/serviceImageUpload', () => ({
    saveServiceImageUpload: jest.fn().mockResolvedValue({
      url: '/assets/services/test.png',
      fileName: 'test.png',
      bytes: 123,
      mimeType: 'image/png'
    })
  }));

  const router = require('../routes/admin');
  const app = express();
  app.use(express.json());
  app.use('/api/admin', router);
  return app;
}

describe('Admin users routes without DB', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('GET /api/admin/users returns normalized user list', async () => {
    const app = createApp((sql) => {
      if (sql.includes('FROM users u') && sql.includes('ORDER BY u.id ASC')) {
        return {
          recordset: [
            {
              id: 2,
              name: 'Nguyen Minh Anh',
              phone: '0911111111',
              email: 'minh.anh@beautycare.vn',
              role: 'user',
              member: 'gold',
              member_expires_at: null,
              email_verified: 1,
              twofa_enabled: 0,
              bookings_count: 2,
              orders_count: 1,
              payments_count: 1,
              subscriptions_count: 0,
              transactions_count: 1
            }
          ]
        };
      }
      return { recordset: [], rowsAffected: [0] };
    });

    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        id: 2,
        phone: '0911111111',
        email_verified: true,
        bookings_count: 2
      })
    ]);
  });

  test('PUT /api/admin/users/:id blocks self role change', async () => {
    const app = createApp((sql, params) => {
      if (sql.includes('WHERE u.id=@id')) {
        return {
          recordset: [
            {
              id: Number(params.get('id')),
              name: 'Admin',
              phone: '0900000000',
              email: 'admin@beautycare.vn',
              role: 'admin',
              member: 'premium',
              member_expires_at: null,
              email_verified: 1,
              twofa_enabled: 0,
              bookings_count: 0,
              orders_count: 0,
              payments_count: 0,
              subscriptions_count: 0,
              transactions_count: 0
            }
          ]
        };
      }
      return { recordset: [], rowsAffected: [0] };
    });

    const res = await request(app).put('/api/admin/users/1').send({
      role: 'user'
    });

    expect(res.status).toBe(400);
    expect(String(res.body?.message || '')).toMatch(/role/i);
  });

  test('DELETE /api/admin/users/:id deletes linked user data in order', async () => {
    const queries = [];
    const app = createApp((sql, params) => {
      queries.push(sql.trim());

      if (sql.includes('WHERE u.id=@id')) {
        return {
          recordset: [
            {
              id: Number(params.get('id')),
              name: 'User Delete',
              phone: '0911111111',
              email: 'delete@beautycare.vn',
              role: 'user',
              member: 'silver',
              member_expires_at: null,
              email_verified: 1,
              twofa_enabled: 0,
              bookings_count: 1,
              orders_count: 1,
              payments_count: 1,
              subscriptions_count: 0,
              transactions_count: 1
            }
          ]
        };
      }

      if (sql.includes("SELECT COUNT(*) AS total FROM users WHERE role='admin'")) {
        return { recordset: [{ total: 2 }] };
      }

      if (sql.startsWith('DELETE FROM')) {
        return { recordset: [], rowsAffected: [1] };
      }

      return { recordset: [], rowsAffected: [0] };
    });

    const res = await request(app).delete('/api/admin/users/2');

    expect(res.status).toBe(200);
    expect(res.body?.removed?.users).toBe(1);
    expect(queries.some((sql) => sql.includes('DELETE FROM payment_events'))).toBe(true);
    expect(queries.some((sql) => sql.includes('DELETE FROM users WHERE id=@id'))).toBe(true);
  });
});
