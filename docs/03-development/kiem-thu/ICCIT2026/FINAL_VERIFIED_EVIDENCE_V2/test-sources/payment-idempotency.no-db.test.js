describe('Payment callback idempotency', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('../db');
  });

  test('serializes duplicate paid callbacks and applies checkout side effects once', async () => {
    jest.resetModules();
    const state = {
      payment: { id: 7, user_id: 11, provider: 'vnpay', purpose: 'checkout', order_id: 21, status: 'created', amount: 250000 },
      order: { id: 21, user_id: 11, status: 'pending', original_price: 300000, discount: 50000, final_price: 250000, voucher_code: 'SAFE20', booking_id: 31 },
      paymentEvents: 0,
      transactions: 0,
      orderPaidUpdates: 0,
      bookingPaidUpdates: 0
    };

    const db = {
      sql: {
        Int: { type: 'int' },
        MAX: 'max',
        NVarChar: Object.assign((length) => ({ type: 'nvarchar', length }), { type: 'nvarchar' }),
        DateTime: { type: 'datetime' }
      }
    };

    class Request {
      constructor() { this.params = new Map(); }
      input(name, _type, value) { this.params.set(name, value); return this; }
      async query(sql) {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        if (text.includes('GET_LOCK')) return { recordset: [{ acquired: 1 }] };
        if (text.includes('RELEASE_LOCK')) return { recordset: [{ released: 1 }] };
        if (text.includes('SELECT TOP (1) * FROM payments')) return { recordset: [state.payment] };
        if (text.includes("UPDATE payments SET status='paid'")) { state.payment.status = 'paid'; return { recordset: [], rowsAffected: [1] }; }
        if (text.includes('INSERT INTO payment_events')) { state.paymentEvents += 1; return { recordset: [], rowsAffected: [1] }; }
        if (text.includes('SELECT TOP (1) * FROM orders')) return { recordset: [state.order] };
        if (text.includes('UPDATE orders SET status=\'paid\'')) { state.order.status = 'paid'; state.orderPaidUpdates += 1; return { recordset: [], rowsAffected: [1] }; }
        if (text.includes('INSERT INTO transactions')) { state.transactions += 1; return { recordset: [], rowsAffected: [1] }; }
        if (text.includes('UPDATE bookings SET status=\'paid\'')) { state.bookingPaidUpdates += 1; return { recordset: [], rowsAffected: [1] }; }
        throw new Error(`Unexpected SQL in idempotency test: ${text}`);
      }
    }

    const pool = { request: () => new Request() };
    db.connect = jest.fn().mockResolvedValue(pool);
    jest.doMock('../db', () => db);

    const router = require('../routes/payments');
    const first = await router.__test.finalizePaid(pool, 'provider-ref-1', { provider: 'vnpay', callback: 'first' });
    const second = await router.__test.finalizePaid(pool, 'provider-ref-1', { provider: 'vnpay', callback: 'retry' });

    expect(first.already).toBe(false);
    expect(second.already).toBe(true);
    expect(state.paymentEvents).toBe(1);
    expect(state.transactions).toBe(1);
    expect(state.orderPaidUpdates).toBe(1);
    expect(state.bookingPaidUpdates).toBe(1);
  });
});
