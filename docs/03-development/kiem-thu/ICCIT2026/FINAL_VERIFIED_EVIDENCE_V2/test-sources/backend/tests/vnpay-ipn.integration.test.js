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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api/payments', paymentsRouter);

const TEST_USER_ID = 1;
const TEST_SERVICE_ID = 1;
const artifactPath = process.env.ICCIT_ARTIFACT_DIR
  ? path.resolve(process.env.ICCIT_ARTIFACT_DIR, 'vnpay-ipn.json')
  : null;

function vnpEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

function signCallback(fields) {
  const sorted = Object.keys(fields)
    .filter((key) => key.startsWith('vnp_') && fields[key] !== undefined && fields[key] !== null && fields[key] !== '')
    .sort()
    .reduce((out, key) => {
      out[key] = fields[key];
      return out;
    }, {});
  const signData = Object.keys(sorted).map((key) => `${vnpEncode(key)}=${vnpEncode(sorted[key])}`).join('&');
  const hash = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET).update(signData, 'utf8').digest('hex');
  return { ...fields, vnp_SecureHash: hash };
}

function callbackFor(providerRef, responseCode = '00', amount = 175000) {
  return signCallback({
    vnp_Amount: String(Math.round(Number(amount)) * 100),
    vnp_BankCode: 'NCB',
    vnp_Command: 'pay',
    vnp_CurrCode: 'VND',
    vnp_OrderInfo: `BeautyCare IPN test ${providerRef}`,
    vnp_ResponseCode: responseCode,
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_TransactionNo: `IPN-TX-${providerRef}`,
    vnp_TransactionStatus: responseCode === '00' ? '00' : responseCode,
    vnp_TxnRef: providerRef,
    vnp_Version: '2.1.0'
  });
}

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
  const payment = await query('SELECT id, status FROM payments WHERE provider_ref=@ref', { ref: providerRef });
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

describe('VNPay IPN contract, idempotency, and recovery (isolated MySQL)', () => {
  const evidence = {
    generatedAt: new Date().toISOString(),
    database: db.config.database,
    endpoints: ['GET /api/payments/vnpay/ipn', 'POST /api/payments/vnpay/ipn'],
    provider: 'vnpay',
    signature: 'HMAC-SHA512 with test-only VNPAY_HASH_SECRET',
    scenarios: []
  };
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
    }
    await db.close();
  });

  test('valid, duplicate, invalid, failed, concurrent, race, and retry IPN cases preserve invariants', async () => {
    const validRef = `ICCIT-IPN-${Date.now()}-valid`;
    const validPrice = 175101;
    const validOrderId = await seedPayment(validRef, validPrice);
    created.push({ providerRef: validRef, orderId: validOrderId, finalPrice: validPrice });
    const valid = await request(app).get('/api/payments/vnpay/ipn').query(callbackFor(validRef, '00', validPrice));
    const duplicate = await request(app).get('/api/payments/vnpay/ipn').query(callbackFor(validRef, '00', validPrice));
    const validState = await readState(validRef, validOrderId, validPrice);
    expect(valid.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(duplicate.body).toEqual({ RspCode: '02', Message: 'Order already confirmed' });
    expect(validState).toMatchObject({ paymentStatus: 'paid', orderStatus: 'paid', paidAtPresent: true, transactions: 1 });
    expect(validState.eventCounts.paid).toBe(1);
    evidence.scenarios.push({ name: 'valid + sequential duplicate IPN', responses: [valid.body, duplicate.body], database: validState });

    const concurrent = [];
    for (let repetition = 1; repetition <= 3; repetition += 1) {
      const providerRef = `ICCIT-IPN-${Date.now()}-concurrent-${repetition}`;
      const finalPrice = 175110 + repetition;
      const orderId = await seedPayment(providerRef, finalPrice);
      created.push({ providerRef, orderId, finalPrice });
      const callback = callbackFor(providerRef, '00', finalPrice);
      const started = Date.now();
      const responses = await Promise.all(Array.from({ length: 50 }, () => request(app).get('/api/payments/vnpay/ipn').query(callback)));
      const state = await readState(providerRef, orderId, finalPrice);
      expect(responses.every((response) => response.status === 200 && ['00', '02'].includes(response.body.RspCode))).toBe(true);
      expect(state).toMatchObject({ paymentStatus: 'paid', orderStatus: 'paid', paidAtPresent: true, transactions: 1 });
      expect(state.eventCounts.paid).toBe(1);
      concurrent.push({ repetition, callbackCount: responses.length, durationMs: Date.now() - started, responseCodes: responses.reduce((a, r) => { a[r.body.RspCode] = (a[r.body.RspCode] || 0) + 1; return a; }, {}), database: state });
    }
    evidence.scenarios.push({ name: 'concurrent duplicate IPN', repetitions: concurrent });

    const invalidSignatureRef = `ICCIT-IPN-${Date.now()}-bad-signature`;
    const invalidSignaturePrice = 175201;
    const invalidSignatureOrderId = await seedPayment(invalidSignatureRef, invalidSignaturePrice);
    created.push({ providerRef: invalidSignatureRef, orderId: invalidSignatureOrderId, finalPrice: invalidSignaturePrice });
    const invalidSignature = callbackFor(invalidSignatureRef, '00', invalidSignaturePrice);
    invalidSignature.vnp_SecureHash = `${invalidSignature.vnp_SecureHash.slice(0, -1)}0`;
    const invalidSignatureResponse = await request(app).get('/api/payments/vnpay/ipn').query(invalidSignature);
    const invalidSignatureState = await readState(invalidSignatureRef, invalidSignatureOrderId, invalidSignaturePrice);
    expect(invalidSignatureResponse.body).toEqual({ RspCode: '97', Message: 'Invalid signature' });
    expect(invalidSignatureState).toMatchObject({ paymentStatus: 'created', orderStatus: 'pending', transactions: 0 });
    evidence.scenarios.push({ name: 'invalid signature', response: invalidSignatureResponse.body, database: invalidSignatureState });

    const invalidAmountRef = `ICCIT-IPN-${Date.now()}-bad-amount`;
    const invalidAmountPrice = 175301;
    const invalidAmountOrderId = await seedPayment(invalidAmountRef, invalidAmountPrice);
    created.push({ providerRef: invalidAmountRef, orderId: invalidAmountOrderId, finalPrice: invalidAmountPrice });
    const invalidAmountResponse = await request(app).get('/api/payments/vnpay/ipn').query(callbackFor(invalidAmountRef, '00', invalidAmountPrice - 1));
    const invalidAmountState = await readState(invalidAmountRef, invalidAmountOrderId, invalidAmountPrice);
    expect(invalidAmountResponse.body).toEqual({ RspCode: '04', Message: 'Invalid amount' });
    expect(invalidAmountState).toMatchObject({ paymentStatus: 'created', orderStatus: 'pending', transactions: 0 });
    evidence.scenarios.push({ name: 'invalid amount', response: invalidAmountResponse.body, database: invalidAmountState });

    const missingRef = `ICCIT-IPN-${Date.now()}-missing`;
    const missingResponse = await request(app).get('/api/payments/vnpay/ipn').query(callbackFor(missingRef, '00', 175401));
    expect(missingResponse.body).toEqual({ RspCode: '01', Message: 'Order not found' });
    evidence.scenarios.push({ name: 'invalid payment reference', response: missingResponse.body });

    const failedRef = `ICCIT-IPN-${Date.now()}-failed`;
    const failedPrice = 175501;
    const failedOrderId = await seedPayment(failedRef, failedPrice);
    created.push({ providerRef: failedRef, orderId: failedOrderId, finalPrice: failedPrice });
    const failedResponse = await request(app).get('/api/payments/vnpay/ipn').query(callbackFor(failedRef, '24', failedPrice));
    const failedState = await readState(failedRef, failedOrderId, failedPrice);
    expect(failedResponse.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(failedState).toMatchObject({ paymentStatus: 'failed', orderStatus: 'pending', transactions: 0 });
    evidence.scenarios.push({ name: 'failed transaction', response: failedResponse.body, database: failedState });

    const raceRef = `ICCIT-IPN-${Date.now()}-return-race`;
    const racePrice = 175601;
    const raceOrderId = await seedPayment(raceRef, racePrice);
    created.push({ providerRef: raceRef, orderId: raceOrderId, finalPrice: racePrice });
    const raceCallback = callbackFor(raceRef, '00', racePrice);
    const [ipnRace, returnRace] = await Promise.all([
      request(app).get('/api/payments/vnpay/ipn').query(raceCallback),
      request(app).get('/api/payments/vnpay/return').query({ ...raceCallback, front: 'http://localhost:5173' })
    ]);
    const raceState = await readState(raceRef, raceOrderId, racePrice);
    expect(ipnRace.status).toBe(200);
    expect(returnRace.status).toBe(302);
    expect(raceState).toMatchObject({ paymentStatus: 'paid', orderStatus: 'paid', transactions: 1 });
    expect(raceState.eventCounts.paid).toBe(1);
    evidence.scenarios.push({ name: 'IPN and Return near-simultaneous', responses: [ipnRace.body, returnRace.status], database: raceState });

    const retryRef = `ICCIT-IPN-${Date.now()}-retry`;
    const retryPrice = 175701;
    const retryOrderId = await seedPayment(retryRef, retryPrice);
    created.push({ providerRef: retryRef, orderId: retryOrderId, finalPrice: retryPrice });
    process.env.PAYMENT_FAULT_INJECTION = 'before_payment_update';
    const injected = await request(app).get('/api/payments/vnpay/ipn').query(callbackFor(retryRef, '00', retryPrice));
    const afterInjected = await readState(retryRef, retryOrderId, retryPrice);
    delete process.env.PAYMENT_FAULT_INJECTION;
    const retried = await request(app).get('/api/payments/vnpay/ipn').query(callbackFor(retryRef, '00', retryPrice));
    const afterRetry = await readState(retryRef, retryOrderId, retryPrice);
    expect(injected.body).toEqual({ RspCode: '99', Message: 'Unknown error' });
    expect(afterInjected).toMatchObject({ paymentStatus: 'created', orderStatus: 'pending', transactions: 0 });
    expect(retried.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(afterRetry).toMatchObject({ paymentStatus: 'paid', orderStatus: 'paid', transactions: 1 });
    expect(afterRetry.eventCounts.paid).toBe(1);
    evidence.scenarios.push({ name: 'temporary database failure and retry', responses: [injected.body, retried.body], beforeRetry: afterInjected, afterRetry });
  }, 180000);
});
