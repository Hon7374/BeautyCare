const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

process.env.VNPAY_TMN_CODE = 'TESTMERCHANT';
const testSecret = String(process.env.VNPAY_TEST_SECRET || '').trim();
if (!testSecret) throw new Error('VNPAY_TEST_SECRET is required for VNPay integration tests');
process.env.VNPAY_HASH_SECRET = testSecret;

const db = require('../db');
const paymentsRouter = require('../routes/payments');

const app = express();
app.use('/api/payments', paymentsRouter);

const TEST_USER_ID = 1;
const TEST_SERVICE_ID = 1;
const FRONTEND = 'http://localhost:5173';
const artifactPath = process.env.ICCIT_ARTIFACT_DIR
  ? path.resolve(process.env.ICCIT_ARTIFACT_DIR, 'vnpay-duplicate-callback.json')
  : null;

function vnpEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

function signCallback(fields) {
  const signedFields = Object.fromEntries(Object.entries(fields).filter(([key]) => key.startsWith('vnp_')));
  const sorted = Object.keys(signedFields)
    .sort()
    .reduce((out, key) => {
      if (signedFields[key] !== undefined && signedFields[key] !== null && signedFields[key] !== '') out[key] = signedFields[key];
      return out;
    }, {});
  const signData = Object.keys(sorted).map((key) => `${vnpEncode(key)}=${vnpEncode(sorted[key])}`).join('&');
  const hash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET).update(signData, 'utf8').digest('hex');
  return { ...fields, vnp_SecureHash: hash };
}

function callbackFor(providerRef, responseCode = '00', amount = 125000) {
  return signCallback({
    vnp_Amount: String(Math.round(Number(amount)) * 100),
    vnp_BankCode: 'TESTBANK',
    vnp_Command: 'pay',
    vnp_CurrCode: 'VND',
    vnp_OrderInfo: `BeautyCare test ${providerRef}`,
    vnp_ResponseCode: responseCode,
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_TransactionNo: `TX-${providerRef}`,
    vnp_TransactionStatus: responseCode === '00' ? '00' : responseCode,
    vnp_TxnRef: providerRef,
    vnp_Version: '2.1.0',
    front: FRONTEND
  });
}

async function query(sql, params = {}) {
  const pool = await db.connect();
  const req = pool.request();
  Object.entries(params).forEach(([name, value]) => {
    req.input(name, value);
  });
  return req.query(sql);
}

async function seedPayment(providerRef, finalPrice) {
  const order = await query(
    `INSERT INTO orders (user_id, service_id, booking_id, original_price, discount, final_price, voucher_code, status)
     VALUES (@uid, @sid, NULL, @original, 0, @final, NULL, 'pending')`,
    { uid: TEST_USER_ID, sid: TEST_SERVICE_ID, original: finalPrice, final: finalPrice }
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
    `SELECT COUNT(*) AS count FROM payment_events
     WHERE payment_id=(SELECT id FROM payments WHERE provider_ref=@ref) AND event_type='paid'`,
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
    paidEvents: Number(events.recordset[0]?.count || 0),
    transactions: Number(transactions.recordset[0]?.count || 0)
  };
}

async function cleanup(providerRef, orderId, finalPrice) {
  await query(
    `DELETE FROM payment_events
     WHERE payment_id=(SELECT id FROM payments WHERE provider_ref=@ref)`,
    { ref: providerRef }
  );
  await query('DELETE FROM payments WHERE provider_ref=@ref', { ref: providerRef });
  await query('DELETE FROM transactions WHERE user_id=@uid AND original_price=@price AND final_price=@price AND voucher_code IS NULL', {
    uid: TEST_USER_ID,
    price: finalPrice
  });
  await query('DELETE FROM orders WHERE id=@oid', { oid: orderId });
}

function redirectStatus(response) {
  return new URL(`http://localhost${response.headers.location}`).searchParams.get('status');
}

describe('VNPay duplicate callback idempotency (isolated MySQL)', () => {
  const evidence = {
    generatedAt: new Date().toISOString(),
    database: db.config.database,
    endpoint: 'GET /api/payments/vnpay/return',
    provider: 'vnpay',
    signature: 'HMAC-SHA512 with test-only VNPAY_HASH_SECRET',
    repetitions: []
  };
  const created = [];

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    for (const item of created.reverse()) {
      await cleanup(item.providerRef, item.orderId, item.finalPrice);
    }
    if (artifactPath) {
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      fs.writeFileSync(artifactPath, JSON.stringify(evidence, null, 2), 'utf8');
    }
    await db.close();
  });

  test('normal, sequential duplicate, concurrent duplicate, tampered, and late callbacks preserve one finalization', async () => {
    const normalRef = `ICCIT-VNPAY-${Date.now()}-normal`;
    const normalPrice = 125000;
    const normalOrderId = await seedPayment(normalRef, normalPrice);
    created.push({ providerRef: normalRef, orderId: normalOrderId, finalPrice: normalPrice });

    const first = await request(app).get('/api/payments/vnpay/return').query(callbackFor(normalRef));
    const second = await request(app).get('/api/payments/vnpay/return').query(callbackFor(normalRef));
    const lateFailure = await request(app).get('/api/payments/vnpay/return').query(callbackFor(normalRef, '24'));
    const normalState = await readState(normalRef, normalOrderId, normalPrice);

    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    expect(lateFailure.status).toBe(302);
    expect(redirectStatus(first)).toBe('paid');
    expect(redirectStatus(second)).toBe('paid');
    expect(redirectStatus(lateFailure)).toBe('failed');
    expect(normalState).toMatchObject({
      paymentStatus: 'paid',
      orderStatus: 'paid',
      paidAtPresent: true,
      paidEvents: 1,
      transactions: 1
    });
    evidence.repetitions.push({
      scenario: 'normal + sequential duplicate + late failure',
      responses: [first.status, second.status, lateFailure.status],
      database: normalState
    });

    for (let repetition = 1; repetition <= 3; repetition += 1) {
      const providerRef = `ICCIT-VNPAY-${Date.now()}-concurrent-${repetition}`;
      const finalPrice = 125000 + repetition;
      const orderId = await seedPayment(providerRef, finalPrice);
      created.push({ providerRef, orderId, finalPrice });
      const callback = callbackFor(providerRef, '00', finalPrice);
      const started = Date.now();
      const responses = await Promise.all(
        Array.from({ length: 50 }, () => request(app).get('/api/payments/vnpay/return').query(callback))
      );
      const durationMs = Date.now() - started;
      const statusCounts = responses.reduce((counts, response) => {
        counts[response.status] = (counts[response.status] || 0) + 1;
        return counts;
      }, {});
      const redirectStatusCounts = responses.reduce((counts, response) => {
        const status = redirectStatus(response);
        counts[status] = (counts[status] || 0) + 1;
        return counts;
      }, {});
      const state = await readState(providerRef, orderId, finalPrice);
      expect(statusCounts[302]).toBe(50);
      expect(redirectStatusCounts.paid).toBe(50);
      expect(state).toMatchObject({
        paymentStatus: 'paid',
        orderStatus: 'paid',
        paidAtPresent: true,
        paidEvents: 1,
        transactions: 1
      });
      evidence.repetitions.push({
        scenario: 'concurrent duplicate callbacks',
        repetition,
        callbackCount: 50,
        statusCounts,
        redirectStatusCounts,
        failureRedirects: redirectStatusCounts.failed || 0,
        durationMs,
        database: state
      });
    }

    const tamperedRef = `ICCIT-VNPAY-${Date.now()}-tampered`;
    const tamperedPrice = 125010;
    const tamperedOrderId = await seedPayment(tamperedRef, tamperedPrice);
    created.push({ providerRef: tamperedRef, orderId: tamperedOrderId, finalPrice: tamperedPrice });
    const tamperedCallback = callbackFor(tamperedRef);
    tamperedCallback.vnp_Amount = '1';
    const tampered = await request(app).get('/api/payments/vnpay/return').query(tamperedCallback);
    const tamperedState = await readState(tamperedRef, tamperedOrderId, tamperedPrice);
    expect(tampered.status).toBe(302);
    expect(redirectStatus(tampered)).toBe('failed');
    expect(tamperedState).toMatchObject({
      paymentStatus: 'created',
      orderStatus: 'pending',
      paidAtPresent: false,
      paidEvents: 0,
      transactions: 0
    });
    evidence.repetitions.push({
      scenario: 'tampered amount with original signature',
      responses: [tampered.status],
      database: tamperedState
    });

    const mismatchRef = `ICCIT-VNPAY-${Date.now()}-valid-signature-amount-mismatch`;
    const mismatchPrice = 126001;
    const mismatchOrderId = await seedPayment(mismatchRef, mismatchPrice);
    created.push({ providerRef: mismatchRef, orderId: mismatchOrderId, finalPrice: mismatchPrice });
    // callbackFor() signs 125000 VND, while the persisted payment is 125001 VND.
    // The signature is valid, but the payment amount must still be rejected.
    const validSignatureWrongAmount = await request(app)
      .get('/api/payments/vnpay/return')
      .query(callbackFor(mismatchRef, '00', 125000));
    const mismatchState = await readState(mismatchRef, mismatchOrderId, mismatchPrice);
    expect(validSignatureWrongAmount.status).toBe(302);
    expect(redirectStatus(validSignatureWrongAmount)).toBe('failed');
    expect(mismatchState).toMatchObject({
      paymentStatus: 'created',
      orderStatus: 'pending',
      paidAtPresent: false,
      paidEvents: 0,
      transactions: 0
    });
    evidence.repetitions.push({
      scenario: 'valid signature with persisted amount mismatch',
      responses: [validSignatureWrongAmount.status],
      database: mismatchState
    });
  }, 120000);
});
