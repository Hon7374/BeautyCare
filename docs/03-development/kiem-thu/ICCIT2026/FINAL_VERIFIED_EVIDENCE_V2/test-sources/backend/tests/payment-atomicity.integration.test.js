const fs = require('fs');
const path = require('path');

const db = require('../db');
const paymentsRouter = require('../routes/payments');

const TEST_USER_ID = 1;
const TEST_SERVICE_ID = 1;
const artifactPath = process.env.ICCIT_ARTIFACT_DIR
  ? path.resolve(process.env.ICCIT_ARTIFACT_DIR, 'payment-atomicity.json')
  : null;

async function query(sql, params = {}) {
  const pool = await db.connect();
  const req = pool.request();
  Object.entries(params).forEach(([name, value]) => req.input(name, value));
  return req.query(sql);
}

async function seedPayment(providerRef, finalPrice) {
  const order = await query(
    `INSERT INTO orders (user_id, service_id, booking_id, original_price, discount, final_price, voucher_code, status)
     VALUES (@uid, @sid, NULL, @price, 0, @price, NULL, 'pending')`,
    { uid: TEST_USER_ID, sid: TEST_SERVICE_ID, price: finalPrice }
  );
  const orderId = Number(order.insertId);
  await query(
    `INSERT INTO payments (user_id, provider, purpose, order_id, amount, provider_ref, status)
     VALUES (@uid, 'vnpay', 'checkout', @oid, @amount, @ref, 'created')`,
    { uid: TEST_USER_ID, oid: orderId, amount: finalPrice, ref: providerRef }
  );
  return orderId;
}

async function readState(providerRef, orderId, finalPrice) {
  const payment = await query('SELECT status FROM payments WHERE provider_ref=@ref', { ref: providerRef });
  const order = await query('SELECT status, paid_at FROM orders WHERE id=@oid', { oid: orderId });
  const events = await query(
    `SELECT event_type, COUNT(*) AS count FROM payment_events
     WHERE payment_id=(SELECT id FROM payments WHERE provider_ref=@ref)
     GROUP BY event_type`,
    { ref: providerRef }
  );
  const transactions = await query(
    `SELECT COUNT(*) AS count FROM transactions
     WHERE user_id=@uid AND original_price=@price AND final_price=@price AND voucher_code IS NULL`,
    { uid: TEST_USER_ID, price: finalPrice }
  );
  return {
    paymentStatus: payment.recordset[0]?.status || null,
    orderStatus: order.recordset[0]?.status || null,
    paidAtPresent: Boolean(order.recordset[0]?.paid_at),
    eventCounts: Object.fromEntries(events.recordset.map((row) => [row.event_type, Number(row.count)])),
    transactions: Number(transactions.recordset[0]?.count || 0)
  };
}

async function cleanup(providerRef, orderId, finalPrice) {
  await query('DELETE FROM payment_events WHERE payment_id=(SELECT id FROM payments WHERE provider_ref=@ref)', { ref: providerRef });
  await query('DELETE FROM payments WHERE provider_ref=@ref', { ref: providerRef });
  await query(
    'DELETE FROM transactions WHERE user_id=@uid AND original_price=@price AND final_price=@price AND voucher_code IS NULL',
    { uid: TEST_USER_ID, price: finalPrice }
  );
  await query('DELETE FROM orders WHERE id=@oid', { oid: orderId });
}

describe('Payment finalization transaction atomicity and recovery (isolated MySQL)', () => {
  const evidence = {
    generatedAt: new Date().toISOString(),
    database: db.config.database,
    function: 'finalizePaid',
    faultPoints: ['before_payment_update', 'after_payment_update', 'before_transaction_insert', 'after_transaction_insert'],
    scenarios: []
  };
  const beforeSnapshots = [];
  const afterSnapshots = [];
  const created = [];

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    delete process.env.PAYMENT_FAULT_INJECTION;
    for (const item of created.reverse()) await cleanup(item.providerRef, item.orderId, item.finalPrice);
    if (artifactPath) {
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      fs.writeFileSync(artifactPath, JSON.stringify(evidence, null, 2), 'utf8');
      fs.writeFileSync(path.join(path.dirname(artifactPath), 'results.json'), JSON.stringify(evidence, null, 2), 'utf8');
      fs.writeFileSync(
        path.join(path.dirname(artifactPath), 'database-before.json'),
        JSON.stringify({ database: db.config.database, scenarios: beforeSnapshots }, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        path.join(path.dirname(artifactPath), 'database-after.json'),
        JSON.stringify({ database: db.config.database, scenarios: afterSnapshots }, null, 2),
        'utf8'
      );
    }
    await db.close();
  });

  test('rolls back each injected failure boundary and succeeds on retry', async () => {
    const faultPoints = ['before_payment_update', 'after_payment_update', 'before_transaction_insert', 'after_transaction_insert'];
    for (let index = 0; index < faultPoints.length; index += 1) {
      const point = faultPoints[index];
      const providerRef = `ICCIT-ATOMICITY-${Date.now()}-${point}`;
      const finalPrice = 186000 + index;
      const orderId = await seedPayment(providerRef, finalPrice);
      created.push({ providerRef, orderId, finalPrice });
      const pool = await db.connect();
      const before = await readState(providerRef, orderId, finalPrice);

      process.env.PAYMENT_FAULT_INJECTION = point;
      let injectedError = null;
      try {
        await paymentsRouter.__test.finalizePaid(pool, providerRef, { provider: 'vnpay', faultPoint: point });
      } catch (error) {
        injectedError = error;
      }
      const afterFailure = await readState(providerRef, orderId, finalPrice);
      delete process.env.PAYMENT_FAULT_INJECTION;
      const retried = await paymentsRouter.__test.finalizePaid(pool, providerRef, { provider: 'vnpay', retry: true });
      const afterRetry = await readState(providerRef, orderId, finalPrice);

      expect(injectedError?.code).toBe('PAYMENT_FAULT_INJECTED');
      expect(afterFailure).toMatchObject({ paymentStatus: 'created', orderStatus: 'pending', paidAtPresent: false, transactions: 0 });
      expect(afterFailure.eventCounts).toEqual({});
      expect(retried.already).toBe(false);
      expect(afterRetry).toMatchObject({ paymentStatus: 'paid', orderStatus: 'paid', paidAtPresent: true, transactions: 1 });
      expect(afterRetry.eventCounts).toEqual({ paid: 1 });
      beforeSnapshots.push({ point, before });
      afterSnapshots.push({ point, afterFailure, afterRetry });
      evidence.scenarios.push({ point, injectedError: injectedError?.message, before, afterFailure, afterRetry });
    }
  }, 120000);
});
