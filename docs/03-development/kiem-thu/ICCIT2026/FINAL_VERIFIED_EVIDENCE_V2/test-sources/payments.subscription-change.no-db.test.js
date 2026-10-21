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
      MAX: 'MAX',
      NVarChar() {
        return { type: 'nvarchar' };
      }
    }
  };
}

function createApp(state) {
  jest.resetModules();

  const queryImpl = (sql, params) => {
    state.queries.push(sql.trim());

    if (sql.includes('FROM subscriptions s') && sql.includes("WHERE s.user_id=@uid AND s.status='active'")) {
      return { recordset: state.activeSubscription ? [state.activeSubscription] : [] };
    }

    if (sql.includes('FROM membership_plans WHERE code=@code AND is_active=1')) {
      const code = String(params.get('code') || '');
      return { recordset: state.plans.filter((plan) => String(plan.code) === code) };
    }

    if (sql.includes('SET plan_id=@pid') && sql.includes('updated_at=GETDATE()') && sql.includes('WHERE id=@sid')) {
      state.instantSwitch = {
        subscriptionId: Number(params.get('sid')),
        planId: Number(params.get('pid'))
      };
      return { recordset: [], rowsAffected: [1] };
    }

    if (sql.includes('SET member=@tier, member_expires_at=@end_at')) {
      state.userUpdate = {
        userId: Number(params.get('uid')),
        tier: String(params.get('tier')),
        endAt: params.get('end_at')
      };
      return { recordset: [], rowsAffected: [1] };
    }

    if (sql.includes('INSERT INTO subscriptions') && sql.includes('OUTPUT INSERTED.id')) {
      const id = state.nextSubscriptionId++;
      state.pendingSubscription = {
        id,
        user_id: Number(params.get('uid')),
        plan_id: Number(params.get('pid')),
        status: 'pending',
        start_at: params.get('start_at'),
        end_at: params.get('end_at'),
        auto_renew: Number(params.get('ar') || 0),
        provider: String(params.get('prov') || '')
      };
      return { recordset: [{ id }], rowsAffected: [1] };
    }

    if (sql.includes('INSERT INTO payments')) {
      const ref = String(params.get('ref'));
      const payment = {
        id: state.nextPaymentId++,
        user_id: Number(params.get('uid')),
        provider: String(params.get('prov') || ''),
        purpose: String(params.get('purpose') || ''),
        subscription_id: Number(params.get('sid')),
        amount: Number(params.get('amt') || 0),
        provider_ref: ref,
        status: 'created'
      };
      state.paymentsByRef.set(ref, payment);
      return { recordset: [], rowsAffected: [1] };
    }

    if (sql === 'UPDATE payments SET status=@st WHERE provider_ref=@ref') {
      const payment = state.paymentsByRef.get(String(params.get('ref')));
      if (payment) payment.status = String(params.get('st'));
      return { recordset: [], rowsAffected: [payment ? 1 : 0] };
    }

    if (sql === 'SELECT TOP (1) * FROM payments WHERE provider_ref=@ref') {
      const payment = state.paymentsByRef.get(String(params.get('ref')));
      return { recordset: payment ? [payment] : [] };
    }

    if (sql.includes('INSERT INTO payment_events')) {
      return { recordset: [], rowsAffected: [1] };
    }

    if (sql.includes('SELECT TOP (1) email FROM users WHERE id=@uid')) {
      return { recordset: [{ email: 'user@example.com' }] };
    }

    return { recordset: [], rowsAffected: [0] };
  };

  jest.doMock('../db', () => createDbMock(queryImpl));
  jest.doMock('../middleware/auth', () => ({
    verify(req, res, next) {
      req.user = { id: 1, role: 'user' };
      next();
    }
  }));
  jest.doMock('../utils/pricing', () => ({
    calculateServiceTotal: jest.fn()
  }));
  jest.doMock('../utils/audit', () => ({
    audit: jest.fn().mockResolvedValue()
  }));
  jest.doMock('../utils/runtime', () => ({
    publicAppUrl: jest.fn(() => 'http://localhost:5500')
  }));
  jest.doMock('../utils/providers/vnpay', () => ({
    createPaymentUrl: jest.fn(() => 'https://sandbox.vnpay.test/pay'),
    verifyReturn: jest.fn(() => ({ ok: true }))
  }));
  jest.doMock('../utils/providers/momo', () => ({
    createPayment: jest.fn().mockResolvedValue({ payUrl: 'https://momo.test/pay' }),
    verifyIpn: jest.fn(() => ({ ok: true }))
  }));
  jest.doMock('../utils/providers/stripe', () => ({
    createCheckoutSession: jest.fn().mockResolvedValue({ url: 'https://stripe.test/pay' }),
    createSubscriptionCheckoutSession: jest.fn().mockResolvedValue({ url: 'https://stripe.test/sub' }),
    constructEvent: jest.fn()
  }));

  const router = require('../routes/payments');
  const app = express();
  app.use(express.json());
  app.use('/api/payments', router);
  return app;
}

function createPlansFallbackApp() {
  jest.resetModules();

  jest.doMock('../db', () => ({
    connect: jest.fn().mockRejectedValue(new Error("Access denied for user 'root'@'localhost'")),
    sql: {
      Int: { type: 'int' },
      Bit: { type: 'bit' },
      DateTime: { type: 'datetime' },
      MAX: 'MAX',
      NVarChar() {
        return { type: 'nvarchar' };
      }
    }
  }));

  const router = require('../routes/payments');
  const app = express();
  app.use(express.json());
  app.use('/api/payments', router);
  return app;
}

describe('Payments subscription change routes without DB', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('GET /api/payments/plans falls back to seeded demo plans when DB is unavailable', async () => {
    const app = createPlansFallbackApp();
    const res = await request(app).get('/api/payments/plans');

    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(4);
    expect(res.body.plans.map((plan) => plan.code)).toEqual([
      'GOLD_MONTHLY',
      'PREMIUM_MONTHLY',
      'GOLD_YEARLY',
      'PREMIUM_YEARLY'
    ]);
  });

  test('POST /api/payments/change-subscription switches immediately when new plan is not more expensive', async () => {
    const state = {
      queries: [],
      plans: [
        { id: 3, code: 'GOLD_MONTHLY', name: 'Gói Vàng 1 tháng', tier: 'gold', price: 99000, duration_days: 30 }
      ],
      activeSubscription: {
        id: 12,
        user_id: 1,
        plan_id: 4,
        plan_code: 'PREMIUM_MONTHLY',
        plan_name: 'Gói Premium 1 tháng',
        plan_price: 199000,
        plan_tier: 'premium',
        duration_days: 30,
        start_at: new Date('2026-04-01T00:00:00Z'),
        end_at: new Date('2026-05-01T00:00:00Z'),
        auto_renew: 1,
        status: 'active'
      },
      nextSubscriptionId: 50,
      nextPaymentId: 80,
      paymentsByRef: new Map()
    };

    const app = createApp(state);
    const res = await request(app).post('/api/payments/change-subscription').send({
      provider: 'qr',
      planCode: 'GOLD_MONTHLY',
      returnBase: 'http://localhost:5500'
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      ok: true,
      mode: 'instant',
      amount: 0
    }));
    expect(state.instantSwitch).toEqual({
      subscriptionId: 12,
      planId: 3
    });
    expect(state.userUpdate).toEqual(expect.objectContaining({
      userId: 1,
      tier: 'gold'
    }));
  });

  test('POST /api/payments/change-subscription creates payment for price difference when target plan is more expensive', async () => {
    const state = {
      queries: [],
      plans: [
        { id: 9, code: 'PREMIUM_MONTHLY', name: 'Gói Premium 1 tháng', tier: 'premium', price: 199000, duration_days: 30 }
      ],
      activeSubscription: {
        id: 21,
        user_id: 1,
        plan_id: 3,
        plan_code: 'GOLD_MONTHLY',
        plan_name: 'Gói Vàng 1 tháng',
        plan_price: 99000,
        plan_tier: 'gold',
        duration_days: 30,
        start_at: new Date('2026-04-01T00:00:00Z'),
        end_at: new Date('2026-05-01T00:00:00Z'),
        auto_renew: 0,
        status: 'active'
      },
      nextSubscriptionId: 60,
      nextPaymentId: 90,
      paymentsByRef: new Map()
    };

    const app = createApp(state);
    const res = await request(app).post('/api/payments/change-subscription').send({
      provider: 'qr',
      planCode: 'PREMIUM_MONTHLY',
      returnBase: 'http://localhost:5500'
    });

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(100000);
    expect(res.body.diffAmount).toBe(100000);
    expect(String(res.body.redirectUrl || '')).toContain('/user/qr-pay.html?ref=');
    expect(state.pendingSubscription).toEqual(expect.objectContaining({
      user_id: 1,
      plan_id: 9,
      status: 'pending'
    }));

    const createdPayment = Array.from(state.paymentsByRef.values())[0];
    expect(createdPayment).toEqual(expect.objectContaining({
      provider: 'qr',
      purpose: 'subscription_change',
      amount: 100000,
      status: 'pending'
    }));
  });
});
