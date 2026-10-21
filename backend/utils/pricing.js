
const db = require('../db');

const _cache = {
  policies: null,
  settings: null,
  exp: 0
};

function _now() {
  return Date.now();
}

async function loadDiscountConfig(pool) {
  const ttlMs = 60 * 1000; // cache 60s
  if (_cache.policies && _cache.settings && _cache.exp > _now()) {
    return { policies: _cache.policies, settings: _cache.settings };
  }

  // Policies
  let policies = { silver: 0.05, gold: 0.10, premium: 0.20 };
  try {
    const pr = await pool.request().query('SELECT tier, rate FROM discount_policies');
    for (const row of pr.recordset || []) {
      const tier = String(row.tier || '').toLowerCase();
      const rate = Number(row.rate);
      if (tier && Number.isFinite(rate)) {
        policies[tier] = rate;
      }
    }
  } catch (_) {
    // table may not exist in older DB; fallback defaults
  }

  // Settings
  let settings = { max_total_rate: 0.95 };
  try {
    const sr = await pool.request().query('SELECT [key], [value] FROM discount_settings');
    for (const row of sr.recordset || []) {
      const k = String(row.key || '').toLowerCase();
      const v = String(row.value || '').trim();
      if (k === 'max_total_rate') {
        const n = Number(v);
        if (Number.isFinite(n)) settings.max_total_rate = n;
      }
    }
  } catch (_) {
    // fallback defaults
  }

  _cache.policies = policies;
  _cache.settings = settings;
  _cache.exp = _now() + ttlMs;

  return { policies, settings };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function calculateDiscountAmounts({ originalPrice, memberRate, voucherRate, maxTotalRate }) {
  const price = Number(originalPrice);
  if (!Number.isFinite(price) || price < 0) {
    const error = new Error('INVALID_SERVICE_PRICE');
    error.status = 500;
    throw error;
  }

  const safeMemberRate = clamp(Number(memberRate) || 0, 0, 1);
  const safeVoucherRate = clamp(Number(voucherRate) || 0, 0, 1);
  const cap = clamp(Number(maxTotalRate ?? 0.95) || 0, 0, 0.95);
  const totalRate = clamp(safeMemberRate + safeVoucherRate, 0, cap);
  const discountAmount = Math.round(price * totalRate);
  const finalPrice = Math.max(0, price - discountAmount);

  return { originalPrice: price, memberRate: safeMemberRate, voucherRate: safeVoucherRate, maxTotalRate: cap, totalRate, discountAmount, finalPrice };
}

async function memberDiscountRate(pool, member) {
  const { policies } = await loadDiscountConfig(pool);
  const m = String(member || '').toLowerCase();
  return Number.isFinite(policies[m]) ? policies[m] : policies.silver;
}

async function calculateServiceTotal(pool, userId, serviceId, voucherCode) {
  const serviceRs = await pool
    .request()
    .input('id', db.sql.Int, Number(serviceId))
    .query('SELECT id, name, price FROM services WHERE id=@id');

  if (serviceRs.recordset.length === 0) {
    const err = new Error('SERVICE_NOT_FOUND');
    err.status = 404;
    throw err;
  }
  const service = serviceRs.recordset[0];

  const userRs = await pool
    .request()
    .input('uid', db.sql.Int, Number(userId))
    .query('SELECT id, name, email, member FROM users WHERE id=@uid');

  if (userRs.recordset.length === 0) {
    const err = new Error('USER_NOT_FOUND');
    err.status = 404;
    throw err;
  }
  const user = userRs.recordset[0];

  const originalPrice = Number(service.price);

  const { settings } = await loadDiscountConfig(pool);
  const memberRate = await memberDiscountRate(pool, user.member);

  let voucherRate = 0;
  let usedVoucher = null;

  if (voucherCode && String(voucherCode).trim()) {
    const code = String(voucherCode).trim();
    const vRs = await pool
      .request()
      .input('code', db.sql.NVarChar, code)
      .query('SELECT code, discount, expired_at FROM vouchers WHERE code=@code');

    if (vRs.recordset.length > 0) {
      const v = vRs.recordset[0];
      const today = new Date();
      const exp = v.expired_at ? new Date(v.expired_at) : null;
      const todayDate = new Date(today.toDateString());
      const expDate = exp ? new Date(exp.toDateString()) : null;

      if (!expDate || expDate >= todayDate) {
        voucherRate = clamp(Number(v.discount || 0) / 100, 0, 1);
        usedVoucher = v.code;
      }
    }
  }

  const amounts = calculateDiscountAmounts({
    originalPrice,
    memberRate,
    voucherRate,
    maxTotalRate: settings.max_total_rate
  });

  return {
    service: { id: service.id, name: service.name, price: originalPrice },
    user: { id: user.id, name: user.name, email: user.email, member: user.member },
    originalPrice: amounts.originalPrice,
    memberRate: amounts.memberRate,
    voucherRate: amounts.voucherRate,
    discountAmount: amounts.discountAmount,
    finalPrice: amounts.finalPrice,
    voucherCode: usedVoucher,
    maxTotalRate: amounts.maxTotalRate
  };
}

module.exports = { loadDiscountConfig, memberDiscountRate, calculateDiscountAmounts, calculateServiceTotal };
