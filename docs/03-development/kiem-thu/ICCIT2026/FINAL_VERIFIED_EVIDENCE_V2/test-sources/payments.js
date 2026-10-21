const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../db');
const { verify } = require('../middleware/auth');
const { calculateServiceTotal } = require('../utils/pricing');
const { audit } = require('../utils/audit');
const { publicAppUrl, paymentMode } = require('../utils/runtime');

const vnpay = require('../utils/providers/vnpay');
const momo = require('../utils/providers/momo');
const stripe = require('../utils/providers/stripe');
const paypal = require('../utils/providers/paypal');
const { withMysqlNamedLock } = require('../utils/mysqlLocks');

const router = express.Router();

const FALLBACK_MEMBERSHIP_PLANS = [
  { id: 1, code: 'GOLD_MONTHLY', name: 'Gói Vàng 1 tháng', tier: 'gold', price: 99000, duration_days: 30 },
  { id: 2, code: 'PREMIUM_MONTHLY', name: 'Gói Premium 1 tháng', tier: 'premium', price: 199000, duration_days: 30 },
  { id: 3, code: 'GOLD_YEARLY', name: 'Gói Vàng 1 năm', tier: 'gold', price: 990000, duration_days: 365 },
  { id: 4, code: 'PREMIUM_YEARLY', name: 'Gói Premium 1 năm', tier: 'premium', price: 1990000, duration_days: 365 }
];

function fallbackMembershipPlans() {
  return FALLBACK_MEMBERSHIP_PLANS.map((plan) => ({ ...plan }));
}

// GET /api/payments/plans
// Public: list active membership plans
router.get('/plans', async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool
      .request()
      .query(
        "SELECT id, code, name, tier, price, duration_days FROM membership_plans WHERE is_active=1 ORDER BY price ASC"
      );
    res.json({ plans: rs.recordset });
  } catch (e) {
    console.warn('PAYMENTS_PLANS_FALLBACK', e?.message || e);
    res.json({ plans: fallbackMembershipPlans() });
  }
});

function defaultFrontendBaseUrl() {
  return publicAppUrl();
}

// Accept a frontend base URL from the client to fix Live Server path issues.
// We keep a conservative allowlist to avoid open redirects.
function normalizeFrontendBase(raw, fallback) {
  const fb = fallback || defaultFrontendBaseUrl();
  if (!raw) return fb;
  try {
    const u = new URL(String(raw));
    if (!['http:', 'https:'].includes(u.protocol)) return fb;
    const allowedHosts = (process.env.FRONTEND_ALLOWED_HOSTS || 'localhost,127.0.0.1')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Also allow the host of FRONTEND_URL if provided.
    try {
      const def = new URL(fb);
      if (!allowedHosts.includes(def.hostname)) allowedHosts.push(def.hostname);
    } catch (_) {
      // ignore
    }

    if (!allowedHosts.includes(u.hostname)) return fb;
    const cleanedPath = String(u.pathname || '').replace(/\/$/, '');
    return `${u.origin}${cleanedPath}`;
  } catch (_) {
    return fb;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ipFromReq(req) {
  let ip =
    (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0] : '') ||
    req.ip ||
    req.connection?.remoteAddress ||
    '127.0.0.1';

  ip = String(ip).trim();
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.replace('::ffff:', '');
  return ip;
}

function maybeInjectPaymentFailure(point) {
  if (String(process.env.PAYMENT_FAULT_INJECTION || '').trim() !== point) return;
  const error = new Error(`PAYMENT_FAULT_INJECTED:${point}`);
  error.code = 'PAYMENT_FAULT_INJECTED';
  throw error;
}

function shouldUseMockGateway(provider) {
  const p = String(provider || '').toLowerCase();

  // Mock remains the safe default, even if a developer has test credentials in
  // a local .env file. Set PAYMENTS_MODE=real deliberately to leave the demo
  // gateway.
  if (paymentMode() !== 'real') return true;

  // In real mode, VNPay keeps its existing sandbox/live integration behavior.
  if (p === 'vnpay') return false;

  // Stripe Checkout is real only when the server-side key is present. This
  // preserves the local mock flow for missing/placeholder credentials.
  if (p === 'stripe') return !stripe.isConfigured();

  // PayPal calls the real PayPal Orders API only when credentials are configured.
  // Without sandbox keys, it falls back to the existing local mock gateway so the demo still runs.
  if (p === 'paypal') return !paypal.isConfigured();

  // Existing MoMo behavior in this project stays mock-friendly.
  return true;
}

function stripeSuccessUrl(apiBase, providerRef, front) {
  // Stripe replaces this documented placeholder after Checkout succeeds. The
  // success handler uses it to retrieve and verify the actual session before
  // changing any local payment state.
  return `${apiBase}/api/payments/stripe/success?ref=${encodeURIComponent(providerRef)}&front=${encodeURIComponent(front)}&session_id={CHECKOUT_SESSION_ID}`;
}

function stripeCancelUrl(apiBase, providerRef, front) {
  return `${apiBase}/api/payments/stripe/cancel?ref=${encodeURIComponent(providerRef)}&front=${encodeURIComponent(front)}`;
}

async function createStripeCheckoutRedirect({ amount, description, providerRef, purpose, apiBase, front }) {
  const session = await stripe.createCheckoutSession({
    amount,
    currency: 'vnd',
    description,
    successUrl: stripeSuccessUrl(apiBase, providerRef, front),
    cancelUrl: stripeCancelUrl(apiBase, providerRef, front),
    metadata: { providerRef, purpose }
  });

  if (!session?.url) {
    const err = new Error('STRIPE_CHECKOUT_URL_MISSING');
    err.status = 502;
    throw err;
  }
  return session.url;
}

function stripeSessionIsPaid(session) {
  const paymentStatus = String(session?.payment_status || '').toLowerCase();
  const sessionStatus = String(session?.status || '').toLowerCase();
  return sessionStatus === 'complete' && (paymentStatus === 'paid' || paymentStatus === 'no_payment_required');
}

function stripeSessionMatchesReference(session, providerRef) {
  const sessionRef = String(session?.metadata?.providerRef || session?.client_reference_id || '');
  return Boolean(providerRef) && sessionRef === String(providerRef);
}

function paypalReturnUrl(apiBase, providerRef, front) {
  return `${apiBase}/api/payments/paypal/return?ref=${encodeURIComponent(providerRef)}&front=${encodeURIComponent(front)}`;
}

function paypalCancelUrl(apiBase, providerRef, front) {
  return `${apiBase}/api/payments/paypal/cancel?ref=${encodeURIComponent(providerRef)}&front=${encodeURIComponent(front)}`;
}

async function createPayPalRedirect({ amount, description, providerRef, apiBase, front }) {
  const order = await paypal.createOrder({
    amount,
    description,
    referenceId: providerRef,
    returnUrl: paypalReturnUrl(apiBase, providerRef, front),
    cancelUrl: paypalCancelUrl(apiBase, providerRef, front)
  });

  if (!order.approveUrl) {
    const err = new Error('PAYPAL_APPROVE_URL_MISSING');
    err.status = 502;
    throw err;
  }

  return order.approveUrl;
}

async function getActiveSubscriptionByUser(pool, userId) {
  const rs = await pool
    .request()
    .input('uid', db.sql.Int, Number(userId))
    .query(`
      SELECT TOP (1)
        s.*,
        p.code AS plan_code,
        p.name AS plan_name,
        p.price AS plan_price,
        p.tier AS plan_tier,
        p.duration_days
      FROM subscriptions s
      JOIN membership_plans p ON p.id = s.plan_id
      WHERE s.user_id=@uid AND s.status='active' AND s.end_at > GETDATE()
      ORDER BY s.end_at DESC, s.id DESC
    `);
  return rs.recordset[0] || null;
}

async function getPlanByCode(pool, planCode) {
  const rs = await pool
    .request()
    .input('code', db.sql.NVarChar, String(planCode))
    .query('SELECT TOP (1) * FROM membership_plans WHERE code=@code AND is_active=1');
  return rs.recordset[0] || null;
}

async function switchSubscriptionInstant(pool, { userId, subscriptionId, planId, tier, endAt }) {
  await pool
    .request()
    .input('sid', db.sql.Int, Number(subscriptionId))
    .input('pid', db.sql.Int, Number(planId))
    .query(`
      UPDATE subscriptions
      SET plan_id=@pid, updated_at=GETDATE()
      WHERE id=@sid
    `);

  await pool
    .request()
    .input('uid', db.sql.Int, Number(userId))
    .input('tier', db.sql.NVarChar, String(tier))
    .input('end_at', db.sql.DateTime, endAt || null)
    .query(`
      UPDATE users
      SET member=@tier, member_expires_at=@end_at
      WHERE id=@uid
    `);
}

async function getPaymentByRef(pool, providerRef) {
  const rs = await pool
    .request()
    .input('ref', db.sql.NVarChar, String(providerRef))
    .query('SELECT TOP (1) * FROM payments WHERE provider_ref=@ref');
  return rs.recordset[0] || null;
}

async function markPaymentStatus(pool, providerRef, status, meta) {
  const current = await getPaymentByRef(pool, providerRef);
  if (!current) return;

  const currentStatus = String(current.status || '').toLowerCase();
  const nextStatus = String(status || '').toLowerCase();
  // Provider callbacks can be retried or arrive out of order. Never let a
  // late failure/cancel overwrite a paid payment, or revive a terminal one.
  if (currentStatus === 'paid' || (['failed', 'cancelled'].includes(currentStatus) && nextStatus === 'paid')) {
    return { payment: current, ignored: true };
  }

  await pool
    .request()
    .input('ref', db.sql.NVarChar, String(providerRef))
    .input('st', db.sql.NVarChar, String(status))
    .query('UPDATE payments SET status=@st WHERE provider_ref=@ref');

  const p = await getPaymentByRef(pool, providerRef);
  if (!p) return;

  // payment_events may be missing in some DB dumps -> ignore
  try {
    await pool
      .request()
      .input('pid', db.sql.Int, Number(p.id))
      .input('prov', db.sql.NVarChar, String(p.provider))
      .input('type', db.sql.NVarChar, String(status))
      .input('payload', db.sql.NVarChar(db.sql.MAX), meta ? JSON.stringify(meta).slice(0, 4000) : null)
      .query(
        `
        INSERT INTO payment_events (payment_id, provider, event_type, payload)
        VALUES (@pid, @prov, @type, @payload)
        `
      );
  } catch (e) {
    console.warn('⚠️ payment_events insert skipped:', e?.message || e);
  }
}

// A customer may return from a provider screen, change payment methods, or
// click Pay again.  Keep only one live attempt per booking: old incomplete
// attempts are explicitly cancelled before a fresh provider reference is made.
async function cancelPendingBookingPaymentAttempts(pool, { bookingId, userId, reason }) {
  const pending = await pool
    .request()
    .input('bid', db.sql.Int, Number(bookingId))
    .input('uid', db.sql.Int, Number(userId))
    .query(
      "SELECT provider_ref FROM payments WHERE booking_id=@bid AND user_id=@uid AND LOWER(status) IN ('created','pending')"
    );

  for (const row of pending.recordset) {
    await markPaymentStatus(pool, row.provider_ref, 'cancelled', {
      reason: reason || 'superseded_by_new_booking_checkout'
    });
  }

  await pool
    .request()
    .input('bid', db.sql.Int, Number(bookingId))
    .input('uid', db.sql.Int, Number(userId))
    .query("UPDATE orders SET status='cancelled' WHERE booking_id=@bid AND user_id=@uid AND LOWER(status) IN ('created','pending')");

  return pending.recordset.length;
}



async function finalizePaidUnlocked(pool, providerRef, meta) {
  const payment = await getPaymentByRef(pool, providerRef);
  if (!payment) {
    const err = new Error('PAYMENT_NOT_FOUND');
    err.status = 404;
    throw err;
  }
  const currentStatus = String(payment.status || '').toLowerCase();
  if (currentStatus === 'paid' || ['failed', 'cancelled'].includes(currentStatus)) {
    return { payment, already: true };
  }

  maybeInjectPaymentFailure('before_payment_update');
  await pool
    .request()
    .input('ref', db.sql.NVarChar, String(providerRef))
    .query("UPDATE payments SET status='paid', paid_at=GETDATE() WHERE provider_ref=@ref");
  maybeInjectPaymentFailure('after_payment_update');

  // Record the provider callback exactly once. The caller holds a MySQL
  // named lock for this provider reference, so concurrent/retried callbacks
  // cannot create duplicate paid events or duplicate business side effects.
  try {
    await pool
      .request()
      .input('pid', db.sql.Int, Number(payment.id))
      .input('prov', db.sql.NVarChar, String(payment.provider))
      .input('type', db.sql.NVarChar, 'paid')
      .input('payload', db.sql.NVarChar(db.sql.MAX), meta ? JSON.stringify(meta).slice(0, 4000) : null)
      .query(`
        INSERT INTO payment_events (payment_id, provider, event_type, payload)
        VALUES (@pid, @prov, @type, @payload)
      `);
  } catch (e) {
    console.warn('⚠️ payment paid event insert skipped:', e?.message || e);
  }

  // Checkout -> mark order paid + insert transaction
  if (payment.purpose === 'checkout' && payment.order_id) {
    const or = await pool
      .request()
      .input('oid', db.sql.Int, Number(payment.order_id))
      .query('SELECT TOP (1) * FROM orders WHERE id=@oid');

    if (or.recordset.length > 0) {
      const order = or.recordset[0];
      if (String(order.status).toLowerCase() !== 'paid') {
        await pool
          .request()
          .input('oid', db.sql.Int, Number(payment.order_id))
          .query("UPDATE orders SET status='paid', paid_at=GETDATE() WHERE id=@oid");

        maybeInjectPaymentFailure('before_transaction_insert');

        await pool
          .request()
          .input('uid', db.sql.Int, Number(order.user_id))
          .input('op', db.sql.Int, Number(order.original_price))
          .input('dc', db.sql.Int, Number(order.discount))
          .input('fp', db.sql.Int, Number(order.final_price))
          .input('vc', db.sql.NVarChar, order.voucher_code)
          .query(
            `
            INSERT INTO transactions (user_id, original_price, discount, final_price, voucher_code)
            VALUES (@uid, @op, @dc, @fp, @vc)
            `
          );

        maybeInjectPaymentFailure('after_transaction_insert');
      }

      // If this order was created from a booking, mark the booking as 'paid'
      // (Admin can later set it to confirmed/completed).
      if (order.booking_id) {
        await pool
          .request()
          .input('bid', db.sql.Int, Number(order.booking_id))
          .query("UPDATE bookings SET status='paid' WHERE id=@bid AND status IN ('pending','confirmed')");
      }
    }
  }

  // Subscription -> activate
  if (payment.purpose === 'subscription' && payment.subscription_id) {
    const sr = await pool
      .request()
      .input('sid', db.sql.Int, Number(payment.subscription_id))
      .query(
        `
        SELECT s.*, p.code AS plan_code, p.price AS plan_price, p.tier, p.duration_days
        FROM subscriptions s
        JOIN membership_plans p ON s.plan_id = p.id
        WHERE s.id=@sid
        `
      );

    if (sr.recordset.length > 0) {
      const s = sr.recordset[0];
      if (String(s.status).toLowerCase() !== 'active') {
        const days = Number(s.duration_days) || 30;
        await pool
          .request()
          .input('sid', db.sql.Int, Number(payment.subscription_id))
          .input('days', db.sql.Int, days)
          .query(
            `
            UPDATE subscriptions
            SET status='active', start_at=GETDATE(), end_at=DATEADD(day, @days, GETDATE()), updated_at=GETDATE()
            WHERE id=@sid
            `
          );

        await pool
          .request()
          .input('uid', db.sql.Int, Number(s.user_id))
          .input('tier', db.sql.NVarChar, String(s.tier))
          .input('days', db.sql.Int, days)
          .query(
            `
            UPDATE users
            SET member=@tier, member_expires_at=DATEADD(day, @days, GETDATE())
            WHERE id=@uid
            `
          );

// Save a transaction record for subscription purchase
        await pool
          .request()
          .input('uid', db.sql.Int, Number(s.user_id))
          .input('op', db.sql.Int, Number(s.plan_price || payment.amount))
          .input('dc', db.sql.Int, 0)
          .input('fp', db.sql.Int, Number(s.plan_price || payment.amount))
          .input('vc', db.sql.NVarChar, `SUBSCRIPTION:${String(s.plan_code || '').slice(0, 40)}`)
          .query(
            `
            INSERT INTO transactions (user_id, original_price, discount, final_price, voucher_code)
            VALUES (@uid, @op, @dc, @fp, @vc)
            `
          );
      }
    }
  }

  // Subscription change -> keep remaining expiry, only switch plan after the top-up is paid
  if (payment.purpose === 'subscription_change' && payment.subscription_id) {
    const sr = await pool
      .request()
      .input('sid', db.sql.Int, Number(payment.subscription_id))
      .query(
        `
        SELECT s.*, p.code AS plan_code, p.price AS plan_price, p.tier, p.duration_days
        FROM subscriptions s
        JOIN membership_plans p ON s.plan_id = p.id
        WHERE s.id=@sid
        `
      );

    if (sr.recordset.length > 0) {
      const s = sr.recordset[0];
      if (String(s.status).toLowerCase() !== 'active') {
        await pool
          .request()
          .input('uid', db.sql.Int, Number(s.user_id))
          .input('sid', db.sql.Int, Number(s.id))
          .query(`
            UPDATE subscriptions
            SET status='cancelled',
                end_at=GETDATE(),
                updated_at=GETDATE()
            WHERE user_id=@uid AND status='active' AND id<>@sid
          `);

        await pool
          .request()
          .input('sid', db.sql.Int, Number(s.id))
          .input('days', db.sql.Int, Number(s.duration_days) || 30)
          .query(`
            UPDATE subscriptions
            SET
              status='active',
              start_at=CASE WHEN start_at IS NULL THEN GETDATE() ELSE start_at END,
              end_at=CASE WHEN end_at IS NULL THEN DATEADD(day, @days, GETDATE()) ELSE end_at END,
              updated_at=GETDATE()
            WHERE id=@sid
          `);

        const activeSub = await pool
          .request()
          .input('sid', db.sql.Int, Number(s.id))
          .query('SELECT TOP (1) user_id, end_at FROM subscriptions WHERE id=@sid');
        const nextEndAt = activeSub.recordset[0]?.end_at || s.end_at || null;

        await pool
          .request()
          .input('uid', db.sql.Int, Number(s.user_id))
          .input('tier', db.sql.NVarChar, String(s.tier))
          .input('end_at', db.sql.DateTime, nextEndAt)
          .query(`
            UPDATE users
            SET member=@tier, member_expires_at=@end_at
            WHERE id=@uid
          `);
      }
    }
  }

  await markPaymentStatus(pool, providerRef, 'paid', meta);

  return { payment: { ...payment, status: 'paid' }, already: false };
}

async function finalizePaid(pool, providerRef, meta) {
  const finalize = typeof db.withTransaction === 'function'
    ? () => db.withTransaction((transactionPool) => finalizePaidUnlocked(transactionPool, providerRef, meta))
    : () => finalizePaidUnlocked(pool, providerRef, meta);
  return withMysqlNamedLock(
    pool,
    `beautycare:payment:${String(providerRef)}`,
    (lockConnection) => {
      if (lockConnection && typeof db.withConnectionTransaction === 'function') {
        return db.withConnectionTransaction(lockConnection, (transactionPool) =>
          finalizePaidUnlocked(transactionPool, providerRef, meta)
        );
      }
      return finalize();
    }
  );
}

// GET /api/payments/status/:ref
router.get('/status/:ref', verify, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool
      .request()
      .input('ref', db.sql.NVarChar, String(req.params.ref))
      .input('uid', db.sql.Int, Number(req.user.id))
      .query('SELECT TOP (1) * FROM payments WHERE provider_ref=@ref AND user_id=@uid');

    if (rs.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
    const p = rs.recordset[0];
    res.json({
      provider: p.provider,
      purpose: p.purpose,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      created_at: p.created_at,
      paid_at: p.paid_at
    });
  } catch (e) {
    console.error('❌ PAYMENTS STATUS ERROR:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/payments/detail/:ref
// Chi tiết hóa đơn/biên nhận để hiển thị cho khách hàng
router.get('/detail/:ref', verify, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request()
      .input('ref', db.sql.NVarChar, String(req.params.ref))
      .input('uid', db.sql.Int, Number(req.user.id))
      .query(`
        SELECT TOP (1)
          p.provider_ref,
          p.provider,
          p.purpose,
          p.amount,
          p.currency,
          p.status,
          p.created_at AS payment_created_at,
          p.paid_at AS payment_paid_at,

          o.id AS order_id,
          o.original_price,
          o.discount,
          o.final_price,
          o.voucher_code,
          o.status AS order_status,
          o.created_at AS order_created_at,
          o.paid_at AS order_paid_at,

          s.id AS service_id,
          s.name AS service_name,
          s.duration_min,

          b.id AS booking_id,
          b.booking_date,
          b.booking_time,
          b.status AS booking_status,

          mp.code AS plan_code,
          mp.name AS plan_name,
          mp.tier AS plan_tier,
          mp.price AS plan_price,
          mp.duration_days,
          sub.status AS subscription_status
        FROM payments p
        LEFT JOIN orders o ON o.id = p.order_id
        LEFT JOIN services s ON s.id = o.service_id
        LEFT JOIN bookings b ON b.id = o.booking_id
        LEFT JOIN subscriptions sub ON sub.id = p.subscription_id
        LEFT JOIN membership_plans mp ON mp.id = sub.plan_id
        WHERE p.provider_ref=@ref AND p.user_id=@uid
      `);

    if (rs.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
    const r = rs.recordset[0];

    res.json({
      ref: r.provider_ref,
      provider: r.provider,
      purpose: r.purpose,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      created_at: r.payment_created_at,
      paid_at: r.payment_paid_at,

      order: r.order_id ? {
        id: r.order_id,
        original_price: r.original_price,
        discount: r.discount,
        final_price: r.final_price,
        voucher_code: r.voucher_code,
        status: r.order_status,
        created_at: r.order_created_at,
        paid_at: r.order_paid_at
      } : null,

      service: r.service_id ? {
        id: r.service_id,
        name: r.service_name,
        duration_min: r.duration_min
      } : null,

      booking: r.booking_id ? {
        id: r.booking_id,
        date: r.booking_date,
        time: r.booking_time,
        status: r.booking_status
      } : null,

      plan: r.plan_code ? {
        code: r.plan_code,
        name: r.plan_name,
        tier: r.plan_tier,
        price: r.plan_price,
        duration_days: r.duration_days,
        status: r.subscription_status
      } : null
    });
  } catch (e) {
    console.error('❌ PAYMENTS DETAIL ERROR:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/payments/qr/detail/:ref
// Public demo QR lookup: only exposes the payment fields needed by the scan-confirm page.
router.get('/qr/detail/:ref', async (req, res) => {
  try {
    const ref = String(req.params.ref || '').trim();
    if (!ref) return res.status(400).json({ message: 'Thiếu mã giao dịch' });

    const pool = await db.connect();
    const rs = await pool.request()
      .input('ref', db.sql.NVarChar, ref)
      .query(`
        SELECT TOP (1)
          provider_ref,
          provider,
          amount,
          currency,
          status,
          created_at,
          paid_at
        FROM payments
        WHERE provider_ref=@ref AND LOWER(provider)='qr'
      `);

    if (rs.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy giao dịch QR' });
    }

    const p = rs.recordset[0];
    res.json({
      ref: p.provider_ref,
      provider: p.provider,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      created_at: p.created_at,
      paid_at: p.paid_at,
      content: `BC ${p.provider_ref}`
    });
  } catch (e) {
    console.error('❌ QR DETAIL ERROR:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/payments/qr/confirm
// Public demo QR flow: scanning the QR opens a payment-confirm page that marks the QR payment paid.
// Production should replace this with bank/provider webhook verification.
router.post('/qr/confirm', async (req, res) => {
  try {
    const ref = String(req.body?.ref || '').trim();
    if (!ref) return res.status(400).json({ message: 'Thiếu mã giao dịch' });

    const pool = await db.connect();
    const rs = await pool.request()
      .input('ref', db.sql.NVarChar, ref)
      .query('SELECT TOP (1) * FROM payments WHERE provider_ref=@ref');

    if (rs.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
    }

    const payment = rs.recordset[0];
    const provider = String(payment.provider || '').toLowerCase();
    const status = String(payment.status || '').toLowerCase();

    if (provider !== 'qr') {
      return res.status(400).json({ message: 'Giao dịch này không phải thanh toán QR' });
    }

    if (['failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Giao dịch đã kết thúc, không thể xác nhận' });
    }

    const amount = Number(req.body?.amount || 0);
    if (amount > 0 && amount !== Number(payment.amount || 0)) {
      return res.status(400).json({ message: 'Số tiền xác nhận không khớp giao dịch' });
    }

    const result = await finalizePaid(pool, ref, {
      provider: 'qr',
      mode: 'scan_confirm',
      ip: ipFromReq(req)
    });

    await audit({
      actorUserId: null,
      action: 'confirm_qr_payment',
      entity: 'payment',
      entityId: ref,
      meta: { already: Boolean(result.already), amount: payment.amount },
      ip: req.ip
    });

    res.json({
      ok: true,
      ref,
      status: 'paid',
      already: Boolean(result.already),
      redirectUrl: `/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=qr&status=paid`
    });
  } catch (e) {
    console.error('❌ QR CONFIRM ERROR:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/payments/checkout
// Body: { provider: 'vnpay'|'momo'|'stripe'|'paypal', serviceId, voucherCode? }
router.post('/checkout', verify, async (req, res) => {
  try {
    const { provider, serviceId, voucherCode } = req.body || {};
    const pvd = String(provider || '').toLowerCase();
    if (!['vnpay', 'momo', 'stripe', 'paypal', 'qr', 'cash'].includes(pvd)) {
      return res.status(400).json({ message: 'provider không hợp lệ (vnpay|momo|stripe|paypal|qr|cash)' });
    }
    if (!serviceId) return res.status(400).json({ message: 'Thiếu serviceId' });

    const pool = await db.connect();
    const calc = await calculateServiceTotal(pool, req.user.id, serviceId, voucherCode);

    // Create order
    const orderRs = await pool
      .request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .input('sid', db.sql.Int, Number(serviceId))
      .input('op', db.sql.Int, Number(calc.originalPrice))
      .input('dc', db.sql.Int, Number(calc.discountAmount))
      .input('fp', db.sql.Int, Number(calc.finalPrice))
      .input('vc', db.sql.NVarChar, calc.voucherCode)
      .query(
        `
        INSERT INTO orders (user_id, service_id, original_price, discount, final_price, voucher_code, status)
        OUTPUT INSERTED.id
        VALUES (@uid, @sid, @op, @dc, @fp, @vc, 'pending')
        `
      );

    const orderId = orderRs.recordset[0].id;
    const providerRef = uuidv4().replace(/-/g, '');

    await pool
      .request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .input('prov', db.sql.NVarChar, pvd)
      .input('purpose', db.sql.NVarChar, 'checkout')
      .input('oid', db.sql.Int, Number(orderId))
      .input('amt', db.sql.Int, Number(calc.finalPrice))
      .input('ref', db.sql.NVarChar, providerRef)
      .query(
        `
        INSERT INTO payments (user_id, provider, purpose, order_id, amount, provider_ref, status)
        VALUES (@uid, @prov, @purpose, @oid, @amt, @ref, 'created')
        `
      );

    await audit({
      actorUserId: req.user.id,
      action: 'PAYMENT_CREATE',
      entity: 'payments',
      entityId: providerRef,
      meta: { provider: pvd, purpose: 'checkout', serviceId, amount: calc.finalPrice },
      ip: ipFromReq(req)
    });

    const apiBase = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const front = normalizeFrontendBase(req.body?.returnBase, defaultFrontendBaseUrl());
    const doneUrl = `${front}/user/payment-result.html?ref=${encodeURIComponent(providerRef)}&provider=${encodeURIComponent(pvd)}`;

    let redirectUrl = null;

    if (pvd === 'cash') {
      // Offline: pay at counter
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'offline_cash' });
      return res.json({ provider: pvd, ref: providerRef, amount: calc.finalPrice, redirectUrl: doneUrl, doneUrl });
    }

    if (pvd === 'qr') {
      // Offline QR: show QR page (demo)
      const qrUrl = `${front}/user/qr-pay.html?ref=${encodeURIComponent(providerRef)}&amount=${encodeURIComponent(calc.finalPrice)}`;
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'offline_qr' });
      return res.json({ provider: pvd, ref: providerRef, amount: calc.finalPrice, redirectUrl: qrUrl, doneUrl });
    }

    if (shouldUseMockGateway(pvd)) {
      redirectUrl = `${apiBase}/api/payments/mock/pay?ref=${encodeURIComponent(providerRef)}&provider=${encodeURIComponent(pvd)}&front=${encodeURIComponent(front)}`;
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'mock' });
      return res.json({ provider: pvd, ref: providerRef, amount: calc.finalPrice, redirectUrl, doneUrl });
    }

    if (pvd === 'vnpay') {
      const url = vnpay.createPaymentUrl({
        amount: calc.finalPrice,
        txnRef: providerRef,
        orderInfo: `BeautyCare checkout #${orderId}`,
        ipAddr: ipFromReq(req),
        returnUrl: `${apiBase}/api/payments/vnpay/return?front=${encodeURIComponent(front)}`
      });
      redirectUrl = url;
    } else if (pvd === 'momo') {
      const momoRs = await momo.createPayment({
        amount: calc.finalPrice,
        orderId: providerRef,
        orderInfo: `BeautyCare checkout #${orderId}`,
        returnUrl: `${apiBase}/api/payments/vnpay/return?front=${encodeURIComponent(front)}`,
        notifyUrl: `${apiBase}/api/payments/momo/ipn`
      });
      redirectUrl = momoRs.payUrl || momoRs.deeplink || momoRs.shortLink;
    } else if (pvd === 'stripe') {
      redirectUrl = await createStripeCheckoutRedirect({
        amount: calc.finalPrice,
        description: `BeautyCare checkout #${orderId}`,
        providerRef,
        purpose: 'checkout',
        apiBase,
        front
      });
    } else if (pvd === 'paypal') {
      redirectUrl = await createPayPalRedirect({
        amount: calc.finalPrice,
        description: `BeautyCare checkout #${orderId}`,
        providerRef,
        apiBase,
        front
      });
    }

    await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd });
    res.json({ provider: pvd, ref: providerRef, amount: calc.finalPrice, redirectUrl, doneUrl });
  } catch (err) {
    console.error('❌ PAYMENTS CHECKOUT ERROR:', err);
    if (err.message === 'SERVICE_NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    if (err.message === 'VNPAY_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình VNPay trong .env' });
    if (err.message === 'MOMO_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình MoMo trong .env' });
    if (err.message === 'STRIPE_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình Stripe trong .env' });
    if (err.message === 'PAYPAL_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình PayPal trong .env' });
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/payments/booking-checkout
// Body: { provider: 'vnpay'|'momo'|'stripe'|'paypal', bookingId, voucherCode?, returnBase? }
// Flow: user books first -> then chooses whether to pay.
router.post('/booking-checkout', verify, async (req, res) => {
  try {
    const { provider, bookingId, voucherCode } = req.body || {};
    const pvd = String(provider || '').toLowerCase();
    if (!['vnpay', 'momo', 'stripe', 'paypal', 'qr', 'cash'].includes(pvd)) {
      return res.status(400).json({ message: 'provider không hợp lệ (vnpay|momo|stripe|paypal|qr|cash)' });
    }
    const bid = Number(bookingId);
    if (!bid) return res.status(400).json({ message: 'Thiếu bookingId' });

    const pool = await db.connect();

    const br = await pool
      .request()
      .input('bid', db.sql.Int, bid)
      .input('uid', db.sql.Int, Number(req.user.id))
      .query(
        `
        SELECT TOP (1)
          b.id,
          b.user_id,
          b.service_id,
          b.status,
          b.booking_date,
          b.booking_time,
          s.name AS service_name,
          s.price AS service_price
        FROM bookings b
        JOIN services s ON s.id = b.service_id
        WHERE b.id=@bid AND b.user_id=@uid
        `
      );

    if (br.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });
    const bk = br.recordset[0];
    const st = String(bk.status || '').toLowerCase();
    if (st === 'cancelled') return res.status(400).json({ message: 'Lịch hẹn đã bị hủy' });
    if (st === 'paid' || st === 'completed') return res.status(400).json({ message: 'Lịch hẹn đã được thanh toán' });

    const calc = await calculateServiceTotal(pool, req.user.id, bk.service_id, voucherCode);

    await cancelPendingBookingPaymentAttempts(pool, {
      bookingId: bid,
      userId: req.user.id,
      reason: 'new_booking_checkout_started'
    });

    // Create order linked to booking
    let orderRs;
    try {
      // Some DB dumps may not have orders.booking_id -> fallback to insert without booking_id (demo-friendly)
      orderRs = await pool
        .request()
        .input('uid', db.sql.Int, Number(req.user.id))
        .input('sid', db.sql.Int, Number(bk.service_id))
        .input('bid', db.sql.Int, bid)
        .input('op', db.sql.Int, Number(calc.originalPrice))
        .input('dc', db.sql.Int, Number(calc.discountAmount))
        .input('fp', db.sql.Int, Number(calc.finalPrice))
        .input('vc', db.sql.NVarChar, calc.voucherCode)
        .query(
          `
          INSERT INTO orders (user_id, service_id, booking_id, original_price, discount, final_price, voucher_code, status)
          OUTPUT INSERTED.id
          VALUES (@uid, @sid, @bid, @op, @dc, @fp, @vc, 'pending')
          `
        );
    } catch (e) {
      if (String(e?.message || '').toLowerCase().includes('invalid column name') && String(e?.message || '').toLowerCase().includes('booking_id')) {
        orderRs = await pool
          .request()
          .input('uid', db.sql.Int, Number(req.user.id))
          .input('sid', db.sql.Int, Number(bk.service_id))
          .input('op', db.sql.Int, Number(calc.originalPrice))
          .input('dc', db.sql.Int, Number(calc.discountAmount))
          .input('fp', db.sql.Int, Number(calc.finalPrice))
          .input('vc', db.sql.NVarChar, calc.voucherCode)
          .query(
            `
            INSERT INTO orders (user_id, service_id, original_price, discount, final_price, voucher_code, status)
            OUTPUT INSERTED.id
            VALUES (@uid, @sid, @op, @dc, @fp, @vc, 'pending')
            `
          );
      } else {
        throw e;
      }
    }

    const orderId = orderRs.recordset[0].id;
    const providerRef = uuidv4().replace(/-/g, '');

    await pool
      .request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .input('prov', db.sql.NVarChar, pvd)
      .input('purpose', db.sql.NVarChar, 'checkout')
      .input('oid', db.sql.Int, Number(orderId))
      .input('bid', db.sql.Int, bid)
      .input('amt', db.sql.Int, Number(calc.finalPrice))
      .input('ref', db.sql.NVarChar, providerRef)
      .query(
        `
        INSERT INTO payments (user_id, provider, purpose, order_id, booking_id, amount, provider_ref, status)
        VALUES (@uid, @prov, @purpose, @oid, @bid, @amt, @ref, 'created')
        `
      );

    await audit({
      actorUserId: req.user.id,
      action: 'PAYMENT_CREATE',
      entity: 'payments',
      entityId: providerRef,
      meta: { provider: pvd, purpose: 'booking_checkout', bookingId: bid, serviceId: bk.service_id, amount: calc.finalPrice },
      ip: ipFromReq(req)
    });

    const apiBase = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const front = normalizeFrontendBase(req.body?.returnBase, defaultFrontendBaseUrl());
    const doneUrl = `${front}/user/payment-result.html?ref=${encodeURIComponent(providerRef)}&provider=${encodeURIComponent(pvd)}`;

    let redirectUrl = null;

    // Offline options
    if (pvd === 'cash') {
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'offline_cash', bookingId: bid });
      return res.json({ provider: pvd, ref: providerRef, amount: calc.finalPrice, redirectUrl: doneUrl, doneUrl });
    }
    if (pvd === 'qr') {
      const qrUrl = `${front}/user/qr-pay.html?ref=${encodeURIComponent(providerRef)}&amount=${encodeURIComponent(calc.finalPrice)}`;
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'offline_qr', bookingId: bid });
      return res.json({ provider: pvd, ref: providerRef, amount: calc.finalPrice, redirectUrl: qrUrl, doneUrl });
    }
    if (shouldUseMockGateway(pvd)) {
      redirectUrl = `${apiBase}/api/payments/mock/pay?ref=${encodeURIComponent(providerRef)}&provider=${encodeURIComponent(pvd)}&front=${encodeURIComponent(front)}`;
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'mock', bookingId: bid });
      return res.json({ provider: pvd, ref: providerRef, amount: calc.finalPrice, redirectUrl, doneUrl });
    }

    if (pvd === 'vnpay') {
      redirectUrl = vnpay.createPaymentUrl({
        amount: calc.finalPrice,
        txnRef: providerRef,
        orderInfo: `BeautyCare booking #${bid} (order #${orderId})`,
        ipAddr: ipFromReq(req),
        returnUrl: `${apiBase}/api/payments/vnpay/return?front=${encodeURIComponent(front)}`
      });
    }
    else if (pvd === 'momo') {
      const momoRs = await momo.createPayment({
        amount: calc.finalPrice,
        orderId: providerRef,
        orderInfo: `BeautyCare booking #${bid} (order #${orderId})`,
        returnUrl: `${apiBase}/api/payments/momo/return?front=${encodeURIComponent(front)}`,
        notifyUrl: `${apiBase}/api/payments/momo/ipn`
      });
      redirectUrl = momoRs.payUrl || momoRs.deeplink || momoRs.shortLink;
    }
    else if (pvd === 'stripe') {
      redirectUrl = await createStripeCheckoutRedirect({
        amount: calc.finalPrice,
        description: `BeautyCare booking #${bid} (order #${orderId})`,
        providerRef,
        purpose: 'checkout',
        apiBase,
        front
      });
    }
    else if (pvd === 'paypal') {
      redirectUrl = await createPayPalRedirect({
        amount: calc.finalPrice,
        description: `BeautyCare booking #${bid} (order #${orderId})`,
        providerRef,
        apiBase,
        front
      });
    }

    await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd });
    res.json({ provider: pvd, ref: providerRef, amount: calc.finalPrice, redirectUrl, doneUrl });
  } catch (err) {
    console.error('❌ PAYMENTS BOOKING CHECKOUT ERROR:', err);
    if (err.message === 'SERVICE_NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    if (err.message === 'VNPAY_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình VNPay trong .env' });
    if (err.message === 'MOMO_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình MoMo trong .env' });
    if (err.message === 'STRIPE_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình Stripe trong .env' });
    if (err.message === 'PAYPAL_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình PayPal trong .env' });
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/payments/subscribe
// Body: { provider: 'vnpay'|'momo'|'stripe'|'paypal'|'qr', planCode: string }
router.post('/subscribe', verify, async (req, res) => {
  try {
    const { provider, planCode } = req.body || {};
    const pvd = String(provider || '').toLowerCase();
    if (!['vnpay', 'momo', 'stripe', 'paypal', 'qr'].includes(pvd)) {
      return res.status(400).json({ message: 'provider không hợp lệ (vnpay|momo|stripe|paypal|qr)' });
    }
    if (!planCode) return res.status(400).json({ message: 'Thiếu planCode' });

    const pool = await db.connect();

    const planRs = await pool
      .request()
      .input('code', db.sql.NVarChar, String(planCode))
      .query('SELECT TOP (1) * FROM membership_plans WHERE code=@code AND is_active=1');

    if (planRs.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy gói' });
    const plan = planRs.recordset[0];

    const subRs = await pool
      .request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .input('pid', db.sql.Int, Number(plan.id))
      .input('prov', db.sql.NVarChar, pvd)
      .query(
        `
        INSERT INTO subscriptions (user_id, plan_id, status, provider)
        OUTPUT INSERTED.id
        VALUES (@uid, @pid, 'pending', @prov)
        `
      );
    const subscriptionId = subRs.recordset[0].id;

    const providerRef = uuidv4().replace(/-/g, '');
    await pool
      .request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .input('prov', db.sql.NVarChar, pvd)
      .input('purpose', db.sql.NVarChar, 'subscription')
      .input('sid', db.sql.Int, Number(subscriptionId))
      .input('amt', db.sql.Int, Number(plan.price))
      .input('ref', db.sql.NVarChar, providerRef)
      .query(
        `
        INSERT INTO payments (user_id, provider, purpose, subscription_id, amount, provider_ref, status)
        VALUES (@uid, @prov, @purpose, @sid, @amt, @ref, 'created')
        `
      );

    await audit({
      actorUserId: req.user.id,
      action: 'SUBSCRIPTION_CREATE',
      entity: 'subscriptions',
      entityId: subscriptionId,
      meta: { provider: pvd, planCode: plan.code, amount: plan.price },
      ip: ipFromReq(req)
    });

    const apiBase = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const front = normalizeFrontendBase(req.body?.returnBase, defaultFrontendBaseUrl());
    const doneUrl = `${front}/user/payment-result.html?ref=${encodeURIComponent(providerRef)}&provider=${encodeURIComponent(pvd)}&purpose=subscription`;
    let redirectUrl = null;

    if (pvd === 'qr') {
      const qrUrl = `${front}/user/qr-pay.html?ref=${encodeURIComponent(providerRef)}&amount=${encodeURIComponent(plan.price)}`;
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'offline_qr', purpose: 'subscription' });
      return res.json({ provider: pvd, ref: providerRef, amount: plan.price, redirectUrl: qrUrl, doneUrl });
    }

    if (shouldUseMockGateway(pvd)) {
      redirectUrl = `${apiBase}/api/payments/mock/pay?ref=${encodeURIComponent(providerRef)}&provider=${encodeURIComponent(pvd)}&purpose=subscription&front=${encodeURIComponent(front)}`;
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'mock', purpose: 'subscription' });
      return res.json({ provider: pvd, ref: providerRef, amount: plan.price, redirectUrl, doneUrl });
    }

    if (pvd === 'vnpay') {
      redirectUrl = vnpay.createPaymentUrl({
        amount: plan.price,
        txnRef: providerRef,
        orderInfo: `BeautyCare subscription ${plan.code}`,
        ipAddr: ipFromReq(req),
        returnUrl: `${apiBase}/api/payments/vnpay/return?front=${encodeURIComponent(front)}`
      });
    }
    else if (pvd === 'momo') {
      const momoRs = await momo.createPayment({
        amount: plan.price,
        orderId: providerRef,
        orderInfo: `BeautyCare subscription ${plan.code}`,
        returnUrl: `${apiBase}/api/payments/momo/return?front=${encodeURIComponent(front)}`,
        notifyUrl: `${apiBase}/api/payments/momo/ipn`
      });
      redirectUrl = momoRs.payUrl || momoRs.deeplink || momoRs.shortLink;
    }
    else if (pvd === 'stripe') {
      // You can use Stripe subscription (requires STRIPE_PRICE_ID_<PLAN_CODE> in .env)
      const priceId = process.env[`STRIPE_PRICE_ID_${String(plan.code)}`];
      if (!priceId) {
        return res.status(500).json({ message: `Thiếu STRIPE_PRICE_ID_${plan.code} trong .env` });
      }
      // get user email
      const ur = await pool
        .request()
        .input('uid', db.sql.Int, Number(req.user.id))
        .query('SELECT TOP (1) email FROM users WHERE id=@uid');
      const email = ur.recordset[0]?.email || undefined;
      const session = await stripe.createSubscriptionCheckoutSession({
        customerEmail: email,
        priceId,
        successUrl: stripeSuccessUrl(apiBase, providerRef, front),
        cancelUrl: stripeCancelUrl(apiBase, providerRef, front),
        metadata: { providerRef, purpose: 'subscription' }
      });
      if (!session?.url) {
        const err = new Error('STRIPE_CHECKOUT_URL_MISSING');
        err.status = 502;
        throw err;
      }
      redirectUrl = session.url;
    }
    else if (pvd === 'paypal') {
      redirectUrl = await createPayPalRedirect({
        amount: plan.price,
        description: `BeautyCare subscription ${plan.code}`,
        providerRef,
        apiBase,
        front
      });
    }

    await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, purpose: 'subscription' });
    res.json({ provider: pvd, ref: providerRef, amount: plan.price, redirectUrl, doneUrl });
  } catch (err) {
    console.error('❌ PAYMENTS SUBSCRIBE ERROR:', err);
    if (err.message === 'VNPAY_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình VNPay trong .env' });
    if (err.message === 'MOMO_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình MoMo trong .env' });
    if (err.message === 'STRIPE_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình Stripe trong .env' });
    if (err.message === 'PAYPAL_CONFIG_MISSING') return res.status(500).json({ message: 'Thiếu cấu hình PayPal trong .env' });
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/payments/change-subscription
// Body: { provider: 'vnpay'|'momo'|'stripe'|'paypal'|'qr', planCode: string }
router.post('/change-subscription', verify, async (req, res) => {
  try {
    const { provider, planCode } = req.body || {};
    const pvd = String(provider || '').toLowerCase();
    if (!['vnpay', 'momo', 'stripe', 'paypal', 'qr'].includes(pvd)) {
      return res.status(400).json({ message: 'provider khong hop le (vnpay|momo|stripe|paypal|qr)' });
    }
    if (!planCode) return res.status(400).json({ message: 'Thieu planCode' });

    const pool = await db.connect();
    const current = await getActiveSubscriptionByUser(pool, req.user.id);
    if (!current) {
      return res.status(400).json({ message: 'Ban chua co goi dang hoat dong de doi' });
    }

    const nextPlan = await getPlanByCode(pool, planCode);
    if (!nextPlan) return res.status(404).json({ message: 'Khong tim thay goi' });

    if (String(current.plan_code || '').toLowerCase() === String(nextPlan.code || '').toLowerCase()) {
      return res.status(400).json({ message: 'Ban dang su dung goi nay' });
    }

    const currentPrice = Number(current.plan_price || 0);
    const nextPrice = Number(nextPlan.price || 0);
    const priceDiff = Math.max(0, nextPrice - currentPrice);

    if (priceDiff <= 0) {
      await switchSubscriptionInstant(pool, {
        userId: req.user.id,
        subscriptionId: current.id,
        planId: nextPlan.id,
        tier: nextPlan.tier,
        endAt: current.end_at || null
      });

      await audit({
        actorUserId: req.user.id,
        action: 'SUBSCRIPTION_CHANGE',
        entity: 'subscriptions',
        entityId: current.id,
        meta: {
          mode: 'instant',
          fromPlanCode: current.plan_code,
          toPlanCode: nextPlan.code,
          oldPrice: currentPrice,
          newPrice: nextPrice,
          chargedAmount: 0,
          nonRefundCredit: Math.max(0, currentPrice - nextPrice)
        },
        ip: ipFromReq(req)
      });

      return res.json({
        ok: true,
        mode: 'instant',
        amount: 0,
        diffAmount: 0,
        refundedAmount: 0,
        nonRefundCredit: Math.max(0, currentPrice - nextPrice),
        message: 'Da chuyen doi goi ngay lap tuc',
        subscription: {
          id: current.id,
          status: 'active',
          end_at: current.end_at || null,
          plan: {
            code: nextPlan.code,
            name: nextPlan.name,
            tier: nextPlan.tier,
            price: nextPlan.price,
            duration_days: nextPlan.duration_days
          }
        }
      });
    }

    const subRs = await pool
      .request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .input('pid', db.sql.Int, Number(nextPlan.id))
      .input('prov', db.sql.NVarChar, pvd)
      .input('start_at', db.sql.DateTime, current.start_at || null)
      .input('end_at', db.sql.DateTime, current.end_at || null)
      .input('ar', db.sql.Bit, current.auto_renew ? 1 : 0)
      .query(
        `
        INSERT INTO subscriptions (user_id, plan_id, status, start_at, end_at, auto_renew, provider, updated_at)
        OUTPUT INSERTED.id
        VALUES (@uid, @pid, 'pending', @start_at, @end_at, @ar, @prov, GETDATE())
        `
      );
    const subscriptionId = subRs.recordset[0].id;

    const providerRef = uuidv4().replace(/-/g, '');
    await pool
      .request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .input('prov', db.sql.NVarChar, pvd)
      .input('purpose', db.sql.NVarChar, 'subscription_change')
      .input('sid', db.sql.Int, Number(subscriptionId))
      .input('amt', db.sql.Int, priceDiff)
      .input('ref', db.sql.NVarChar, providerRef)
      .query(
        `
        INSERT INTO payments (user_id, provider, purpose, subscription_id, amount, provider_ref, status)
        VALUES (@uid, @prov, @purpose, @sid, @amt, @ref, 'created')
        `
      );

    await audit({
      actorUserId: req.user.id,
      action: 'SUBSCRIPTION_CHANGE_REQUEST',
      entity: 'subscriptions',
      entityId: subscriptionId,
      meta: {
        provider: pvd,
        fromPlanCode: current.plan_code,
        toPlanCode: nextPlan.code,
        oldPrice: currentPrice,
        newPrice: nextPrice,
        chargedAmount: priceDiff
      },
      ip: ipFromReq(req)
    });

    const apiBase = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const front = normalizeFrontendBase(req.body?.returnBase, defaultFrontendBaseUrl());
    const doneUrl = `${front}/user/payment-result.html?ref=${encodeURIComponent(providerRef)}&provider=${encodeURIComponent(pvd)}&purpose=subscription_change`;
    let redirectUrl = null;

    if (pvd === 'qr') {
      const qrUrl = `${front}/user/qr-pay.html?ref=${encodeURIComponent(providerRef)}&amount=${encodeURIComponent(priceDiff)}`;
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'offline_qr', purpose: 'subscription_change' });
      return res.json({ provider: pvd, ref: providerRef, amount: priceDiff, diffAmount: priceDiff, redirectUrl: qrUrl, doneUrl });
    }

    if (shouldUseMockGateway(pvd)) {
      redirectUrl = `${apiBase}/api/payments/mock/pay?ref=${encodeURIComponent(providerRef)}&provider=${encodeURIComponent(pvd)}&purpose=subscription_change&front=${encodeURIComponent(front)}`;
      await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, mode: 'mock', purpose: 'subscription_change' });
      return res.json({ provider: pvd, ref: providerRef, amount: priceDiff, diffAmount: priceDiff, redirectUrl, doneUrl });
    }

    if (pvd === 'vnpay') {
      redirectUrl = vnpay.createPaymentUrl({
        amount: priceDiff,
        txnRef: providerRef,
        orderInfo: `BeautyCare change subscription ${current.plan_code} -> ${nextPlan.code}`,
        ipAddr: ipFromReq(req),
        returnUrl: `${apiBase}/api/payments/vnpay/return?front=${encodeURIComponent(front)}`
      });
    }
    else if (pvd === 'momo') {
      const momoRs = await momo.createPayment({
        amount: priceDiff,
        orderId: providerRef,
        orderInfo: `BeautyCare change subscription ${current.plan_code} -> ${nextPlan.code}`,
        returnUrl: `${apiBase}/api/payments/momo/return?front=${encodeURIComponent(front)}`,
        notifyUrl: `${apiBase}/api/payments/momo/ipn`
      });
      redirectUrl = momoRs.payUrl || momoRs.deeplink || momoRs.shortLink;
    }
    else if (pvd === 'stripe') {
      redirectUrl = await createStripeCheckoutRedirect({
        amount: priceDiff,
        description: `BeautyCare change subscription ${current.plan_code} -> ${nextPlan.code}`,
        providerRef,
        purpose: 'subscription_change',
        apiBase,
        front
      });
    }
    else if (pvd === 'paypal') {
      redirectUrl = await createPayPalRedirect({
        amount: priceDiff,
        description: `BeautyCare change subscription ${current.plan_code} -> ${nextPlan.code}`,
        providerRef,
        apiBase,
        front
      });
    }

    await markPaymentStatus(pool, providerRef, 'pending', { provider: pvd, purpose: 'subscription_change' });
    res.json({ provider: pvd, ref: providerRef, amount: priceDiff, diffAmount: priceDiff, redirectUrl, doneUrl });
  } catch (err) {
    console.error('PAYMENTS CHANGE SUBSCRIPTION ERROR:', err);
    if (err.message === 'VNPAY_CONFIG_MISSING') return res.status(500).json({ message: 'Thieu cau hinh VNPay trong .env' });
    if (err.message === 'MOMO_CONFIG_MISSING') return res.status(500).json({ message: 'Thieu cau hinh MoMo trong .env' });
    if (err.message === 'STRIPE_CONFIG_MISSING') return res.status(500).json({ message: 'Thieu cau hinh Stripe trong .env' });
    if (err.message === 'PAYPAL_CONFIG_MISSING') return res.status(500).json({ message: 'Thieu cau hinh PayPal trong .env' });
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== MOCK GATEWAY (demo offline) =====
// GET /api/payments/mock/pay?ref=...
router.get('/mock/pay', async (req, res) => {
  const ref = String(req.query.ref || '');
  if (!ref) return res.status(400).send('Missing ref');

  const frontUrl = normalizeFrontendBase(req.query.front, defaultFrontendBaseUrl());
  const front = escapeHtml(frontUrl);
  const provider = String(req.query.provider || 'mock').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'mock';
  const safeProvider = escapeHtml(provider.toUpperCase());
  const safeRef = escapeHtml(ref);
  const okUrl = `/api/payments/mock/complete?ref=${encodeURIComponent(ref)}&provider=${encodeURIComponent(provider)}&status=paid&front=${encodeURIComponent(frontUrl)}`;
  const failUrl = `/api/payments/mock/complete?ref=${encodeURIComponent(ref)}&provider=${encodeURIComponent(provider)}&status=failed&front=${encodeURIComponent(frontUrl)}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(
    `<!doctype html><html><head><meta charset="utf-8"/>
    <title>Mock Gateway</title>
    <style>body{font-family:system-ui;padding:24px;max-width:720px;margin:auto}button{padding:12px 16px;margin-right:12px;border-radius:10px;border:1px solid #ddd;cursor:pointer}</style>
    </head><body>
    <h2>Mock Payment Gateway</h2>
     <p>Provider mock: <b>${safeProvider}</b></p>
     <p>Ref: <b>${safeRef}</b></p>
    <p>Chọn kết quả thanh toán:</p>
    <a href="${okUrl}"><button>✅ Thanh toán thành công</button></a>
    <a href="${failUrl}"><button>❌ Thanh toán thất bại</button></a>
    <p style="margin-top:24px;color:#666">Sau khi chọn, hệ thống sẽ cập nhật trạng thái và chuyển về frontend: ${front}</p>
    </body></html>`
  );
});

// GET /api/payments/mock/complete?ref=...&status=paid|failed
router.get('/mock/complete', async (req, res) => {
  const ref = String(req.query.ref || '');
  const provider = String(req.query.provider || 'mock').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'mock';
  const status = String(req.query.status || 'failed');
  const front = normalizeFrontendBase(req.query.front, defaultFrontendBaseUrl());
  try {
    const pool = await db.connect();
    if (status === 'paid') await finalizePaid(pool, ref, { provider, mode: 'mock' });
    else await markPaymentStatus(pool, ref, 'failed', { provider, mode: 'mock' });
  } catch (e) {
    console.warn('mock complete failed', e?.message || e);
  }
  res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=${encodeURIComponent(provider)}&status=${encodeURIComponent(status)}`);
});

// ===== VNPAY RETURN =====
router.get('/vnpay/return', async (req, res) => {
  const front = normalizeFrontendBase(req.query.front, defaultFrontendBaseUrl());
  const ref = String(req.query.vnp_TxnRef || req.query.ref || '');
  try {
    const verifyRs = vnpay.verifyReturn(req.query || {});
    const rspCode = String(req.query.vnp_ResponseCode || '');
    // Signature verification is a security gate. An invalid/tampered return
    // must not mutate payment, order, booking, or audit state.
    if (!verifyRs.ok) {
      return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=vnpay&status=failed`);
    }
    if (!ref) {
      return res.redirect(`${front}/user/payment-result.html?provider=vnpay&status=failed`);
    }

    const success = rspCode === '00';
    const pool = await db.connect();
    const payment = await getPaymentByRef(pool, ref);
    const expectedAmountMinor = payment ? Math.round(Number(payment.amount || 0) * 100) : NaN;
    const receivedAmountMinor = Number(req.query.vnp_Amount);
    const amountMatches = Number.isSafeInteger(receivedAmountMinor) && receivedAmountMinor === expectedAmountMinor;
    const providerMatches = payment && String(payment.provider || '').toLowerCase() === 'vnpay';
    if (!payment || !providerMatches || !amountMatches) {
      // A valid HMAC is not sufficient if the callback does not describe the
      // locally persisted VNPay payment and amount. Do not mutate state.
      return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=vnpay&status=failed`);
    }
    if (success) await finalizePaid(pool, ref, { provider: 'vnpay', query: req.query });
    else await markPaymentStatus(pool, ref, 'failed', { provider: 'vnpay', query: req.query, verify: verifyRs });
    return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=vnpay&status=${success ? 'paid' : 'failed'}`);
  } catch (e) {
    console.error('❌ VNPAY RETURN ERROR:', e);
    return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=vnpay&status=failed`);
  }
});

function sendVnpayIpnResponse(res, rspCode, message) {
  return res.status(200).json({ RspCode: String(rspCode), Message: String(message) });
}

async function handleVnpayIpn(req, res) {
  const query = req.method === 'POST'
    ? { ...(req.query || {}), ...(req.body || {}) }
    : (req.query || {});
  const ref = String(query.vnp_TxnRef || '').trim();

  try {
    const verifyRs = vnpay.verifyReturn(query);
    if (!verifyRs.ok) return sendVnpayIpnResponse(res, '97', 'Invalid signature');
    if (!ref) return sendVnpayIpnResponse(res, '01', 'Order not found');

    const pool = await db.connect();
    const payment = await getPaymentByRef(pool, ref);
    if (!payment || String(payment.provider || '').toLowerCase() !== 'vnpay') {
      return sendVnpayIpnResponse(res, '01', 'Order not found');
    }

    const expectedAmountMinor = Math.round(Number(payment.amount || 0) * 100);
    const receivedAmountMinor = Number(query.vnp_Amount);
    if (!Number.isSafeInteger(receivedAmountMinor) || receivedAmountMinor !== expectedAmountMinor) {
      return sendVnpayIpnResponse(res, '04', 'Invalid amount');
    }

    const currentStatus = String(payment.status || '').toLowerCase();
    if (['paid', 'failed', 'cancelled'].includes(currentStatus)) {
      return sendVnpayIpnResponse(res, '02', 'Order already confirmed');
    }

    const responseCode = String(query.vnp_ResponseCode || '');
    const transactionStatus = String(query.vnp_TransactionStatus || '');
    const success = responseCode === '00' && (!transactionStatus || transactionStatus === '00');
    if (success) {
      await finalizePaid(pool, ref, { provider: 'vnpay', ipn: query });
    } else {
      await markPaymentStatus(pool, ref, 'failed', { provider: 'vnpay', ipn: query, verify: verifyRs });
    }
    return sendVnpayIpnResponse(res, '00', 'Confirm Success');
  } catch (error) {
    console.error('❌ VNPAY IPN ERROR:', error);
    return sendVnpayIpnResponse(res, '99', 'Unknown error');
  }
}

// VNPay IPN is a server-to-server notification. It deliberately has no auth
// or browser redirect and acknowledges the provider with the documented JSON
// response contract. GET is the Sandbox-compatible route; POST is accepted for
// deployments that configure the provider callback as form/JSON POST.
router.get('/vnpay/ipn', handleVnpayIpn);
router.post('/vnpay/ipn', handleVnpayIpn);

// ===== MOMO IPN + RETURN =====
router.post('/momo/ipn', async (req, res) => {
  try {
    const body = req.body || {};
    const ref = String(body.orderId || '');
    const v = momo.verifyIpn(body);
    const success = v.ok && String(body.resultCode) === '0';
    const pool = await db.connect();
    if (success) await finalizePaid(pool, ref, { provider: 'momo', ipn: body });
    else await markPaymentStatus(pool, ref, 'failed', { provider: 'momo', ipn: body, verify: v });
    return res.json({ message: 'OK' });
  } catch (e) {
    console.error('❌ MOMO IPN ERROR:', e);
    return res.status(200).json({ message: 'OK' });
  }
});

router.get('/momo/return', async (req, res) => {
  const front = normalizeFrontendBase(req.query.front, defaultFrontendBaseUrl());
  const ref = String(req.query.orderId || req.query.ref || '');
  // For safety, rely on IPN for final status. Here we just redirect.
  return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=momo&status=pending`);
});


// ===== PAYPAL RETURN / CANCEL =====
router.get('/paypal/return', async (req, res) => {
  const front = normalizeFrontendBase(req.query.front, defaultFrontendBaseUrl());
  const ref = String(req.query.ref || '');
  const paypalOrderId = String(req.query.token || req.query.orderID || req.query.orderId || '');

  try {
    if (!ref || !paypalOrderId) throw new Error('PAYPAL_RETURN_MISSING_REF_OR_TOKEN');

    const capture = await paypal.captureOrder(paypalOrderId);
    const success = paypal.isCaptureCompleted(capture);
    const pool = await db.connect();

    if (success) {
      await finalizePaid(pool, ref, { provider: 'paypal', paypalOrderId, capture });
    } else {
      await markPaymentStatus(pool, ref, 'failed', { provider: 'paypal', paypalOrderId, capture });
    }

    return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=paypal&status=${success ? 'paid' : 'failed'}`);
  } catch (e) {
    console.error('❌ PAYPAL RETURN ERROR:', e?.message || e);
    try {
      const pool = await db.connect();
      if (ref) await markPaymentStatus(pool, ref, 'failed', { provider: 'paypal', error: e?.message || String(e) });
    } catch (_) {
      // ignore status update failure
    }
    return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=paypal&status=failed`);
  }
});

router.get('/paypal/cancel', async (req, res) => {
  const front = normalizeFrontendBase(req.query.front, defaultFrontendBaseUrl());
  const ref = String(req.query.ref || '');
  try {
    const pool = await db.connect();
    if (ref) await markPaymentStatus(pool, ref, 'cancelled', { provider: 'paypal', via: 'cancel-redirect' });
  } catch (_) {
    // ignore
  }
  return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=paypal&status=cancelled`);
});

// ===== STRIPE WEBHOOK (real) =====
// NOTE: This route expects raw body (Buffer). app.js installs express.raw() for this path.
router.post('/stripe/webhook', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.constructEvent(req.body, sig);

    // Signed Stripe events are the primary source of truth. A completed
    // session can still be unpaid for asynchronous payment methods, so only
    // mark the local payment paid after Stripe reports a paid session.
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = event.data?.object;
      const providerRef = session?.metadata?.providerRef || session?.client_reference_id;
      if (providerRef && stripeSessionIsPaid(session)) {
        const pool = await db.connect();
        await finalizePaid(pool, providerRef, {
          provider: 'stripe',
          eventType: event.type,
          stripeCheckoutSessionId: session?.id
        });
      }
    }
    return res.json({ received: true });
  } catch (e) {
    console.error('❌ STRIPE WEBHOOK ERROR:', e?.message || e);
    return res.status(400).send('Webhook Error');
  }
});

// Stripe success/cancel. The browser redirect is not trusted by itself: it
// carries Stripe's Checkout Session ID, which is retrieved server-side and
// checked against the local reference before finalizing the payment. This also
// makes local Stripe test-mode demos work when a webhook tunnel is unavailable.
router.get('/stripe/success', async (req, res) => {
  const ref = String(req.query.ref || '');
  const sessionId = String(req.query.session_id || '');
  const front = normalizeFrontendBase(req.query.front, defaultFrontendBaseUrl());
  let status = 'pending';

  try {
    if (!ref || !sessionId) throw new Error('STRIPE_RETURN_MISSING_REFERENCE');

    const session = await stripe.retrieveCheckoutSession(sessionId);
    if (!stripeSessionIsPaid(session) || !stripeSessionMatchesReference(session, ref)) {
      throw new Error('STRIPE_RETURN_SESSION_NOT_PAID_OR_MISMATCHED');
    }

    const pool = await db.connect();
    await finalizePaid(pool, ref, {
      provider: 'stripe',
      via: 'verified-success-redirect',
      stripeCheckoutSessionId: session.id
    });
    status = 'paid';
  } catch (e) {
    // Do not mark a payment failed from an untrusted browser redirect. A valid
    // signed webhook may still arrive later (for example after a slow return).
    console.warn('STRIPE_SUCCESS_NOT_FINALIZED', e?.message || e);
  }
  return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=stripe&status=${status}`);
});

router.get('/stripe/cancel', async (req, res) => {
  const ref = String(req.query.ref || '');
  const front = normalizeFrontendBase(req.query.front, defaultFrontendBaseUrl());
  try {
    const pool = await db.connect();
    if (ref) await markPaymentStatus(pool, ref, 'cancelled', { provider: 'stripe', via: 'cancel-redirect' });
  } catch (_) {
    // ignore
  }
  return res.redirect(`${front}/user/payment-result.html?ref=${encodeURIComponent(ref)}&provider=stripe&status=cancelled`);
});

module.exports = router;
module.exports.__test = { finalizePaid, markPaymentStatus };
