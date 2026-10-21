require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');

if (!String(db.config.database || '').toLowerCase().includes('test')) {
  throw new Error(`REFUSING_NON_TEST_DATABASE:${db.config.database}`);
}

const secret = String(process.env.VNPAY_HASH_SECRET || '');
const tmnCode = String(process.env.VNPAY_TMN_CODE || 'TESTMERCHANT');
if (!secret) throw new Error('VNPAY_HASH_SECRET is required out-of-band');

const prefix = 'ICCIT-K6-IPN-';
const outputPath = path.resolve(
  __dirname,
  '../../docs/03-development/kiem-thu/ICCIT2026/raw-results/vnpay-ipn/k6-ipn-fixtures-20261021.json'
);

function vnpEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

function sign(fields) {
  const keys = Object.keys(fields)
    .filter((key) => key.startsWith('vnp_') && fields[key] !== undefined && fields[key] !== null && fields[key] !== '')
    .sort();
  const signData = keys.map((key) => `${vnpEncode(key)}=${vnpEncode(fields[key])}`).join('&');
  return { ...fields, vnp_SecureHash: crypto.createHmac('sha512', secret).update(signData, 'utf8').digest('hex') };
}

async function query(pool, statement, params = {}) {
  const request = pool.request();
  Object.entries(params).forEach(([name, value]) => request.input(name, value));
  return request.query(statement);
}

(async () => {
  const pool = await db.connect();
  const old = await query(pool, 'SELECT id, order_id, amount FROM payments WHERE provider_ref LIKE @prefix', { prefix: `${prefix}%` });
  for (const row of old.recordset) {
    await query(pool, 'DELETE FROM payment_events WHERE payment_id=@pid', { pid: row.id });
    await query(pool, 'DELETE FROM transactions WHERE user_id=1 AND original_price=@amount AND final_price=@amount AND voucher_code IS NULL', { amount: row.amount });
  }
  await query(pool, 'DELETE FROM payments WHERE provider_ref LIKE @prefix', { prefix: `${prefix}%` });
  for (const row of old.recordset) await query(pool, 'DELETE FROM orders WHERE id=@oid', { oid: row.order_id });

  const duplicatePrice = 180001;
  const duplicateRef = `${prefix}P1`;
  const items = [{ ref: duplicateRef, amount: duplicatePrice, workload: 'P1' }];
  for (let index = 1; index <= 100; index += 1) {
    items.push({ ref: `${prefix}P2-${String(index).padStart(3, '0')}`, amount: 180001 + index, workload: 'P2' });
  }

  for (const item of items) {
    const order = await query(
      pool,
      `INSERT INTO orders (user_id, service_id, booking_id, original_price, discount, final_price, voucher_code, status)
       VALUES (1, 1, NULL, @amount, 0, @amount, NULL, 'pending')`,
      { amount: item.amount }
    );
    await query(
      pool,
      `INSERT INTO payments (user_id, provider, purpose, order_id, amount, provider_ref, status)
       VALUES (1, 'vnpay', 'checkout', @orderId, @amount, @ref, 'created')`,
      { orderId: Number(order.insertId), amount: item.amount, ref: item.ref }
    );
    item.orderId = Number(order.insertId);
    item.callback = sign({
      vnp_Amount: String(item.amount * 100),
      vnp_BankCode: 'NCB',
      vnp_Command: 'pay',
      vnp_CurrCode: 'VND',
      vnp_OrderInfo: `BeautyCare k6 IPN ${item.ref}`,
      vnp_ResponseCode: '00',
      vnp_TmnCode: tmnCode,
      vnp_TransactionNo: `K6-TX-${item.ref}`,
      vnp_TransactionStatus: '00',
      vnp_TxnRef: item.ref,
      vnp_Version: '2.1.0'
    });
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    database: db.config.database,
    fixturePurpose: 'local k6 VNPay IPN callback benchmark; test-only rows and HMAC signatures',
    duplicateFixture: 1,
    p1: items.filter((item) => item.workload === 'P1').map(({ ref, amount, orderId, callback }) => ({ ref, amount, orderId, callback })),
    p2: items.filter((item) => item.workload === 'P2').map(({ ref, amount, orderId, callback }) => ({ ref, amount, orderId, callback }))
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');
  console.log(JSON.stringify({ database: db.config.database, p1: artifact.p1.length, p2: artifact.p2.length, outputPath }));
  await db.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
