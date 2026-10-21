const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const { sql } = db;
const { verify, JWT_SECRET } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { durationToMs, randomToken, sha256, sanitizeHtml, createCsrfToken, setAuthCookies, clearAuthCookies, setCsrfCookie } = require('../utils/security');
const { sendEmail } = require('../utils/mailer');
const { authDemoMode, emailDeliveryMode, performanceTestMode, publicAppUrl } = require('../utils/runtime');

const router = express.Router();


// =============================
// Config
// =============================
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '1h';
const REFRESH_TTL_MS = durationToMs(
  process.env.REFRESH_TOKEN_TTL,
  durationToMs(process.env.REFRESH_TOKEN_DAYS ? `${process.env.REFRESH_TOKEN_DAYS}d` : '', 60 * 60 * 1000)
);

// Limit brute-force login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Stateful load tests authenticate one real account per VU. This relaxed
  // limit is reachable only with PERF_TEST=true on a local URL and is never
  // enabled for production or non-local deployments.
  limit: performanceTestMode() ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' }
});

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array()[0]?.msg || 'Dữ liệu không hợp lệ';
    res.status(400).json({ message: msg, errors: errors.array() });
    return false;
  }
  return true;
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  // Convert +84/84xxxxxxxxx => 0xxxxxxxxx (VN)
  if (digits.startsWith('84') && digits.length >= 10) {
    const rest = digits.slice(2);
    if (rest.startsWith('0')) return rest; // 8409.. => 09..
    return '0' + rest;
  }
  return digits;
}

function isValidPhone(raw) {
  const p = normalizePhone(raw);
  // VN numbers are typically 10 digits starting with 0 (allow 10-11 for legacy)
  if (!p) return false;
  if (!p.startsWith('0')) return false;
  return p.length === 10 || p.length === 11;
}

function signAccessToken(user) {
  const jti = randomToken(16);
  const token = jwt.sign({ id: user.id, role: user.role, jti }, JWT_SECRET, { expiresIn: ACCESS_TTL });
  return { token, jti };
}

async function createRefreshToken({ userId, ip, userAgent }) {
  const refreshToken = randomToken(48);
  const tokenHash = sha256(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const pool = await db.connect();
  await pool
    .request()
    .input('user_id', sql.Int, Number(userId))
    .input('token_hash', sql.NVarChar, tokenHash)
    .input('expires_at', sql.DateTime, expiresAt)
    .input('ip', sql.NVarChar, ip || null)
    .input('ua', sql.NVarChar, userAgent || null)
    .query(
      `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip, user_agent)
      VALUES (@user_id, @token_hash, @expires_at, @ip, @ua)
      `
    );

  return { refreshToken, tokenHash, expiresAt };
}

async function revokeRefreshToken(tokenHash, replacedByHash = null) {
  if (!tokenHash) return;
  const pool = await db.connect();
  await pool
    .request()
    .input('token_hash', sql.NVarChar, tokenHash)
    .input('replaced', sql.NVarChar, replacedByHash)
    .query(
      `
      UPDATE refresh_tokens
      SET revoked_at = COALESCE(revoked_at, GETDATE()),
          replaced_by_hash = COALESCE(replaced_by_hash, @replaced)
      WHERE token_hash=@token_hash
      `
    );
}

async function revokeAllRefreshTokensForUser(userId) {
  const pool = await db.connect();
  await pool
    .request()
    .input('user_id', sql.Int, Number(userId))
    .query(
      `
      UPDATE refresh_tokens
      SET revoked_at = COALESCE(revoked_at, GETDATE())
      WHERE user_id=@user_id AND revoked_at IS NULL
      `
    );
}

function sessionIdForTokens({ accessToken, refreshToken } = {}) {
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, JWT_SECRET);
      if (decoded?.jti) return `access:${decoded.jti}`;
    } catch (_) {
      // Use the refresh-token binding below if the access token cannot be read.
    }
  }
  return refreshToken ? `refresh:${sha256(refreshToken)}` : '';
}

function newCsrf(res, tokens = {}) {
  const csrfToken = createCsrfToken(sessionIdForTokens(tokens));
  setCsrfCookie(res, csrfToken);
  return csrfToken;
}

function pickUser(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    member: row.member,
    member_expires_at: row.member_expires_at || null,
    email_verified: Boolean(row.email_verified),
    twofa_enabled: Boolean(row.twofa_enabled)
  };
}

function buildPublicUrl(pathname, params) {
  const base = publicAppUrl();
  const url = new URL(pathname, `${base}/`);
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'undefined' || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function deliverAuthTokenMessage({ type, to, token, expiresAt, actionUrl }) {
  if (authDemoMode()) {
    return {
      mode: 'api_token',
      token,
      expiresAt: expiresAt.toISOString(),
      actionUrl
    };
  }

  const subject = type === 'verify-email'
    ? 'BeautyCare - Email verification'
    : 'BeautyCare - Password reset';

  const text = [
    `Type: ${type}`,
    `To: ${to || 'n/a'}`,
    `Action URL: ${actionUrl}`,
    `Token: ${token}`,
    `Expires at: ${expiresAt.toISOString()}`
  ].join('\n');

  const heading = type === 'verify-email'
    ? 'Xac minh dia chi email'
    : 'Dat lai mat khau';
  const htmlHeading = sanitizeHtml(heading);
  const htmlType = sanitizeHtml(type);
  const htmlActionUrl = sanitizeHtml(actionUrl);
  const htmlToken = sanitizeHtml(token);
  const htmlExpiresAt = sanitizeHtml(expiresAt.toISOString());

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1f2937">
      <h2 style="margin:0 0 16px">${htmlHeading}</h2>
      <p>Xin chao,</p>
      <p>He thong BeautyCare da tao mot yeu cau <b>${htmlType}</b> cho tai khoan cua ban.</p>
      <p>
        <a href="${htmlActionUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px">
          Mo lien ket
        </a>
      </p>
      <p>Neu can nhap tay, su dung token sau:</p>
      <pre style="padding:12px;background:#f3f4f6;border-radius:8px;overflow:auto">${htmlToken}</pre>
      <p>Het han luc: ${htmlExpiresAt}</p>
    </div>
  `.trim();

  try {
    const delivery = await sendEmail({
      to,
      subject,
      text,
      html,
      meta: {
        type,
        token,
        expiresAt: expiresAt.toISOString(),
        actionUrl
      }
    });

    return {
      mode: delivery.mode || emailDeliveryMode(),
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error(`❌ AUTH EMAIL DELIVERY ERROR (${type} -> ${to}):`, error?.message || error);
    return {
      mode: 'smtp_failed',
      expiresAt: expiresAt.toISOString()
    };
  }
}

function deliveryStatusMessage(mode, defaultText) {
  if (mode === 'smtp') return defaultText;
  if (mode === 'outbox_fallback') return `${defaultText} SMTP loi, he thong da luu noi dung vao outbox.`;
  if (mode === 'outbox') return `${defaultText} Kiem tra outbox cua he thong neu chua cau hinh SMTP.`;
  if (mode === 'smtp_failed') return `${defaultText} SMTP loi va fallback outbox dang tat, vui long kiem tra cau hinh email.`;
  return defaultText;
}

function isDatabaseUnavailable(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '');
  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    message.includes('Pool is closed')
  );
}

function respondIfDatabaseUnavailable(res, action, error) {
  if (!isDatabaseUnavailable(error)) return false;
  console.warn(`[auth:${action}] Database unavailable: ${error?.code || error?.message || 'unknown'}`);
  res.status(503).json({
    code: 'DB_UNAVAILABLE',
    message: 'Co so du lieu chua san sang. Hay khoi dong MySQL va import database/beautycare.mysql.sql.'
  });
  return true;
}

// =============================
// CSRF helper (call once from frontend)
// =============================
router.get('/csrf', async (req, res) => {
  const csrfToken = newCsrf(res, {
    accessToken: req.cookies?.access_token,
    refreshToken: req.cookies?.refresh_token
  });
  res.json({ csrfToken });
});

// =============================
// Register
// =============================
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Họ tên phải từ 2-100 ký tự'),
    body('phone')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập số điện thoại')
      .custom((v) => isValidPhone(v)).withMessage('Số điện thoại không hợp lệ'),
    body('email')
      .optional({ checkFalsy: true })
      .trim()
      .isEmail().withMessage('Email không hợp lệ')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8, max: 72 }).withMessage('Mật khẩu phải từ 8-72 ký tự')
      .matches(/[A-Z]/).withMessage('Mật khẩu cần có ít nhất 1 chữ in hoa')
      .matches(/[a-z]/).withMessage('Mật khẩu cần có ít nhất 1 chữ thường')
      .matches(/[0-9]/).withMessage('Mật khẩu cần có ít nhất 1 chữ số')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const { name, phone, email, password } = req.body || {};

      const phoneNorm = normalizePhone(phone);
      const emailNorm = email ? String(email).trim().toLowerCase() : null;

      const pool = await db.connect();

      const existedPhone = await pool
        .request()
        .input('phone', sql.NVarChar, phoneNorm)
        .query('SELECT id FROM users WHERE phone=@phone');
      if (existedPhone.recordset.length > 0) {
        return res.status(409).json({ message: 'Số điện thoại đã tồn tại' });
      }

      if (emailNorm) {
        const existedEmail = await pool
          .request()
          .input('email', sql.NVarChar, emailNorm)
          .query('SELECT id FROM users WHERE email=@email');
        if (existedEmail.recordset.length > 0) {
          return res.status(409).json({ message: 'Email đã tồn tại' });
        }
      }

      const hash = bcrypt.hashSync(password, 10);

      const insert = await pool
        .request()
        .input('name', sql.NVarChar, name)
        .input('phone', sql.NVarChar, phoneNorm)
        .input('email', sql.NVarChar, emailNorm)
        .input('password', sql.NVarChar, hash)
        .query(
          `
          INSERT INTO users (name, phone, email, password, role, member, email_verified, twofa_enabled)
          OUTPUT INSERTED.*
          VALUES (@name, @phone, @email, @password, 'user', 'silver', 0, 0)
          `
        );

      const userRow = insert.recordset[0];
      const user = pickUser(userRow);

      const { token: accessToken } = signAccessToken(user);
      const { refreshToken } = await createRefreshToken({ userId: user.id, ip: req.ip, userAgent: req.headers['user-agent'] });

      setAuthCookies(res, { accessToken, refreshToken });
      const csrfToken = newCsrf(res, { accessToken, refreshToken });

      await audit({
        actorUserId: user.id,
        action: 'register',
        entity: 'user',
        entityId: user.id,
        meta: { phone: user.phone, email: user.email || null },
        ip: req.ip
      });

      res.status(201).json({ user, csrfToken, token: accessToken });
    } catch (err) {
      if (respondIfDatabaseUnavailable(res, 'register', err)) return;
      console.error('❌ REGISTER ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// =============================
// Login (HttpOnly cookies). Supports 2FA.
// =============================
router.post(
  '/login',
  loginLimiter,
  [
    body('email')
      .trim()
      .notEmpty().withMessage('Vui lòng nhập email hoặc số điện thoại')
      .custom((v) => {
        const s = String(v || '').trim();
        if (s.includes('@')) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
        }
        return isValidPhone(s);
      }).withMessage('Email hoặc số điện thoại không hợp lệ'),
    body('password').isString().notEmpty().withMessage('Vui lòng nhập mật khẩu'),
    body('otp').optional().isString().isLength({ min: 6, max: 6 }).withMessage('Mã 2FA phải 6 số')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const { email, password, otp } = req.body || {};

      const identifier = String(email || '').trim();
      const pool = await db.connect();

      let rs;
      if (identifier.includes('@')) {
        const emailNorm = identifier.toLowerCase();
        rs = await pool
          .request()
          .input('email', sql.NVarChar, emailNorm)
          .query('SELECT TOP (1) * FROM users WHERE email=@email');
      } else {
        const phoneNorm = normalizePhone(identifier);
        rs = await pool
          .request()
          .input('phone', sql.NVarChar, phoneNorm)
          .query('SELECT TOP (1) * FROM users WHERE phone=@phone');
      }

      if (!rs || rs.recordset.length === 0) {
        return res.status(401).json({ message: 'Sai email/SĐT hoặc mật khẩu' });
      }

      const userRow = rs.recordset[0];
      const ok = bcrypt.compareSync(password, userRow.password);
      if (!ok) {
        return res.status(401).json({ message: 'Sai email/SĐT hoặc mật khẩu' });
      }

      // 2FA check
      if (userRow.twofa_enabled) {
        if (!otp) {
          return res.status(401).json({ code: 'TWO_FA_REQUIRED', message: 'Tài khoản này bật 2FA. Vui lòng nhập mã 6 số.' });
        }
        const valid = speakeasy.totp.verify({
          secret: String(userRow.twofa_secret || ''),
          encoding: 'base32',
          token: String(otp),
          window: 1
        });
        if (!valid) {
          return res.status(401).json({ code: 'TWO_FA_INVALID', message: 'Mã 2FA không đúng' });
        }
      }

      const user = pickUser(userRow);

      const { token: accessToken } = signAccessToken(user);
      const { refreshToken } = await createRefreshToken({ userId: user.id, ip: req.ip, userAgent: req.headers['user-agent'] });
      setAuthCookies(res, { accessToken, refreshToken });
      const csrfToken = newCsrf(res, { accessToken, refreshToken });

      await audit({ actorUserId: user.id, action: 'login', entity: 'user', entityId: user.id, meta: { identifier }, ip: req.ip });
      res.json({ user, csrfToken, token: accessToken });
    } catch (err) {
      if (respondIfDatabaseUnavailable(res, 'login', err)) return;
      console.error('❌ LOGIN ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// =============================
// Refresh (rotation)
// =============================
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ message: 'No refresh token' });

    const tokenHash = sha256(token);
    const pool = await db.connect();
    const rs = await pool
      .request()
      .input('token_hash', sql.NVarChar, tokenHash)
      .query(
        `
        SELECT TOP (1) *
        FROM refresh_tokens
        WHERE token_hash=@token_hash
        `
      );

    if (rs.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const row = rs.recordset[0];
    if (row.revoked_at) {
      return res.status(401).json({ message: 'Refresh token revoked' });
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    // rotate
    const { refreshToken: newRefresh, tokenHash: newHash } = await createRefreshToken({
      userId: row.user_id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    await revokeRefreshToken(tokenHash, newHash);

    // new access token
    const userRs = await pool
      .request()
      .input('id', sql.Int, Number(row.user_id))
      .query('SELECT id,name,phone,email,role,member,member_expires_at,email_verified,twofa_enabled FROM users WHERE id=@id');

    if (userRs.recordset.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    const user = pickUser(userRs.recordset[0]);
    const { token: accessToken } = signAccessToken(user);
    setAuthCookies(res, { accessToken, refreshToken: newRefresh });
    const csrfToken = newCsrf(res, { accessToken, refreshToken: newRefresh });

    await audit({ actorUserId: user.id, action: 'refresh', entity: 'token', entityId: String(row.id), meta: {}, ip: req.ip });

    res.json({ ok: true, csrfToken, user, token: accessToken });
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, 'refresh', err)) return;
    console.error('❌ REFRESH ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =============================
// Logout (revoke refresh + clear cookies)
// =============================
router.post('/logout', async (req, res) => {
  try {
    const refresh = req.cookies?.refresh_token;
    if (refresh) {
      await revokeRefreshToken(sha256(refresh));
    }

    // Best-effort revoke current access token jti (if present)
    const access = req.cookies?.access_token;
    if (access) {
      try {
        const decoded = jwt.verify(access, JWT_SECRET, { ignoreExpiration: true });
        const jti = decoded?.jti;
        const exp = decoded?.exp;
        const uid = decoded?.id;
        if (jti && exp) {
          const expiresAt = new Date(Number(exp) * 1000);
          const pool = await db.connect();
          await pool
            .request()
            .input('jti', sql.NVarChar, String(jti))
            .input('uid', sql.Int, Number(uid || 0))
            .input('expires_at', sql.DateTime, expiresAt)
            .query(
              `
              INSERT INTO revoked_tokens (jti, user_id, expires_at)
              VALUES (@jti, @uid, @expires_at)
              ON DUPLICATE KEY UPDATE jti = jti
              `
            );
        }
      } catch (_) {
        // ignore
      }
    }

    clearAuthCookies(res);
    // rotate csrf so stale token won't pass
    newCsrf(res);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ LOGOUT ERROR:', err);
    clearAuthCookies(res);
    res.status(200).json({ ok: true });
  }
});

// =============================
// Me
// =============================
router.get('/me', verify, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool
      .request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT id,name,phone,email,role,member,member_expires_at,email_verified,twofa_enabled FROM users WHERE id=@id');

    if (rs.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    const user = pickUser(rs.recordset[0]);

    // Attach active membership subscription (if any)
    try {
      const subRs = await pool
        .request()
        .input('uid', sql.Int, req.user.id)
        .query(`
          SELECT TOP (1)
            s.id, s.status, s.start_at, s.end_at, s.auto_renew, s.provider,
            p.code, p.name, p.tier, p.price, p.duration_days
          FROM subscriptions s
          INNER JOIN membership_plans p ON p.id = s.plan_id
          WHERE s.user_id=@uid AND s.status='active' AND s.end_at > GETDATE()
          ORDER BY s.end_at DESC, s.id DESC
        `);

      if (subRs.recordset.length > 0) {
        const r = subRs.recordset[0];
        user.subscription = {
          id: r.id,
          status: r.status,
          start_at: r.start_at,
          end_at: r.end_at,
          auto_renew: Boolean(r.auto_renew),
          provider: r.provider,
          plan: {
            code: r.code,
            name: r.name,
            tier: r.tier,
            price: r.price,
            duration_days: r.duration_days
          }
        };
      } else {
        user.subscription = null;
      }
    } catch (_) {
      user.subscription = null;
    }

    res.json(user);
  } catch (err) {
    if (respondIfDatabaseUnavailable(res, 'me', err)) return;
    console.error('❌ ME ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile minimal info (name/phone/email)
router.put(
  '/me',
  verify,
  [
    body('name').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 100 }).withMessage('Họ tên phải từ 2-100 ký tự'),
    body('phone')
      .optional({ checkFalsy: true })
      .trim()
      .custom((v) => isValidPhone(v)).withMessage('Số điện thoại không hợp lệ'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isEmail().withMessage('Email không hợp lệ')
      .normalizeEmail()
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const { name, phone, email } = req.body || {};

      if (typeof name === 'undefined' && typeof phone === 'undefined' && typeof email === 'undefined') {
        return res.status(400).json({ message: 'Không có dữ liệu để cập nhật' });
      }

      const pool = await db.connect();
      const curRs = await pool
        .request()
        .input('id', sql.Int, req.user.id)
        .query('SELECT TOP (1) id,name,phone,email,email_verified,role,member,member_expires_at,twofa_enabled FROM users WHERE id=@id');

      if (curRs.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      const cur = curRs.recordset[0];

      const newName = (typeof name === 'string' && name.trim()) ? name.trim() : cur.name;
      const newPhone = (typeof phone === 'string' && phone.trim()) ? normalizePhone(phone) : cur.phone;

      let newEmail = cur.email;
      if (email === null) newEmail = null;
      else if (typeof email === 'string') {
        const t = email.trim();
        newEmail = t ? t.toLowerCase() : null;
      }

      if (!newPhone) return res.status(400).json({ message: 'Số điện thoại là bắt buộc' });

      // unique checks
      if (newPhone !== cur.phone) {
        const exP = await pool
          .request()
          .input('id', sql.Int, req.user.id)
          .input('phone', sql.NVarChar, newPhone)
          .query('SELECT id FROM users WHERE phone=@phone AND id<>@id');
        if (exP.recordset.length > 0) return res.status(409).json({ message: 'Số điện thoại đã tồn tại' });
      }

      if (newEmail && newEmail !== cur.email) {
        const exE = await pool
          .request()
          .input('id', sql.Int, req.user.id)
          .input('email', sql.NVarChar, newEmail)
          .query('SELECT id FROM users WHERE email=@email AND id<>@id');
        if (exE.recordset.length > 0) return res.status(409).json({ message: 'Email đã tồn tại' });
      }

      const emailVerified = (newEmail && newEmail === cur.email) ? cur.email_verified : 0;

      await pool
        .request()
        .input('id', sql.Int, req.user.id)
        .input('name', sql.NVarChar, newName)
        .input('phone', sql.NVarChar, newPhone)
        .input('email', sql.NVarChar, newEmail)
        .input('ev', sql.Bit, emailVerified)
        .query('UPDATE users SET name=@name, phone=@phone, email=@email, email_verified=@ev WHERE id=@id');

      await audit({
        actorUserId: req.user.id,
        action: 'update_profile',
        entity: 'user',
        entityId: req.user.id,
        meta: { name: newName, phone: newPhone, email: newEmail },
        ip: req.ip
      });

      // return fresh /me payload (including subscription)
      const meRs = await pool
        .request()
        .input('id', sql.Int, req.user.id)
        .query('SELECT id,name,phone,email,role,member,member_expires_at,email_verified,twofa_enabled FROM users WHERE id=@id');

      const user = pickUser(meRs.recordset[0]);
      user.subscription = null;
      try {
        const subRs = await pool
          .request()
          .input('uid', sql.Int, req.user.id)
          .query(`
            SELECT TOP (1)
              s.id, s.status, s.start_at, s.end_at, s.auto_renew, s.provider,
              p.code, p.name, p.tier, p.price, p.duration_days
            FROM subscriptions s
            INNER JOIN membership_plans p ON p.id = s.plan_id
            WHERE s.user_id=@uid AND s.status='active' AND s.end_at > GETDATE()
            ORDER BY s.end_at DESC, s.id DESC
          `);
        if (subRs.recordset.length > 0) {
          const r = subRs.recordset[0];
          user.subscription = {
            id: r.id,
            status: r.status,
            start_at: r.start_at,
            end_at: r.end_at,
            auto_renew: Boolean(r.auto_renew),
            provider: r.provider,
            plan: { code: r.code, name: r.name, tier: r.tier, price: r.price, duration_days: r.duration_days }
          };
        }
      } catch (_) {
        user.subscription = null;
      }

      res.json(user);
    } catch (err) {
      console.error('❌ UPDATE ME ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// =============================
// Email verification (demo: return token)
// =============================
router.post('/request-verify-email', verify, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request().input('id', sql.Int, req.user.id).query('SELECT email_verified,email FROM users WHERE id=@id');
    if (rs.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
    const currentEmail = rs.recordset[0]?.email || null;
    if (!currentEmail) return res.status(400).json({ message: 'Tai khoan chua co email de xac minh' });
    if (rs.recordset[0].email_verified) return res.json({ ok: true, message: 'Email đã được xác minh' });

    const token = randomToken(32);
    const hash = sha256(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await pool
      .request()
      .input('user_id', sql.Int, req.user.id)
      .input('token_hash', sql.NVarChar, hash)
      .input('expires_at', sql.DateTime, expiresAt)
      .query('INSERT INTO email_verify_tokens (user_id, token_hash, expires_at) VALUES (@user_id,@token_hash,@expires_at)');

    await audit({ actorUserId: req.user.id, action: 'request_email_verification', entity: 'user', entityId: req.user.id, meta: {}, ip: req.ip });

    const delivery = await deliverAuthTokenMessage({
      type: 'verify-email',
      to: currentEmail,
      token,
      expiresAt,
      actionUrl: buildPublicUrl('/api/auth/verify-email', { token })
    });

    res.json({
      ok: true,
      message: authDemoMode()
        ? 'Da tao token xac minh email.'
        : deliveryStatusMessage(delivery.mode, 'Da tao yeu cau xac minh email. Kiem tra email cua ban.'),
      deliveryMode: delivery.mode,
      expiresAt: delivery.expiresAt,
      actionUrl: delivery.actionUrl,
      token: delivery.token
    });
  } catch (err) {
    console.error('❌ REQUEST VERIFY EMAIL ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public one-click link used in verification emails.  It deliberately does not
// require an authenticated session: the signed, single-use token is the proof.
router.get('/verify-email', async (req, res) => {
  const loginUrl = (emailVerified) => buildPublicUrl('/login.html', { emailVerified });

  try {
    const token = String(req.query.token || '');
    if (token.length < 10) return res.redirect(loginUrl('invalid'));

    const hash = sha256(token);
    const pool = await db.connect();
    const rs = await pool
      .request()
      .input('token_hash', sql.NVarChar, hash)
      .query(
        `
        SELECT TOP (1) *
        FROM email_verify_tokens
        WHERE token_hash=@token_hash AND used_at IS NULL AND expires_at > GETDATE()
        ORDER BY id DESC
        `
      );

    if (rs.recordset.length === 0) return res.redirect(loginUrl('invalid'));

    const row = rs.recordset[0];
    await pool.request().input('id', sql.Int, row.user_id).query('UPDATE users SET email_verified=1 WHERE id=@id');
    await pool.request().input('id', sql.Int, row.id).query('UPDATE email_verify_tokens SET used_at=GETDATE() WHERE id=@id');
    await audit({ actorUserId: row.user_id, action: 'verify_email', entity: 'user', entityId: row.user_id, meta: {}, ip: req.ip });

    return res.redirect(loginUrl('success'));
  } catch (err) {
    console.error('EMAIL VERIFY LINK ERROR:', err);
    return res.redirect(loginUrl('error'));
  }
});

router.post(
  '/verify-email',
  [body('token').isString().isLength({ min: 10 }).withMessage('Thiếu token')],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const token = req.body.token;
      const hash = sha256(token);
      const pool = await db.connect();
      const rs = await pool
        .request()
        .input('token_hash', sql.NVarChar, hash)
        .query(
          `
          SELECT TOP (1) *
          FROM email_verify_tokens
          WHERE token_hash=@token_hash AND used_at IS NULL AND expires_at > GETDATE()
          ORDER BY id DESC
          `
        );
      if (rs.recordset.length === 0) return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });

      const row = rs.recordset[0];
      await pool.request().input('id', sql.Int, row.user_id).query('UPDATE users SET email_verified=1 WHERE id=@id');
      await pool.request().input('id', sql.Int, row.id).query('UPDATE email_verify_tokens SET used_at=GETDATE() WHERE id=@id');

      await audit({ actorUserId: row.user_id, action: 'verify_email', entity: 'user', entityId: row.user_id, meta: {}, ip: req.ip });
      res.json({ ok: true });
    } catch (err) {
      console.error('❌ VERIFY EMAIL ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// =============================
// Password reset (demo: return token)
// =============================
router.post(
  '/forgot-password',
  [body('email').trim().isEmail().withMessage('Email không hợp lệ').normalizeEmail()],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const { email } = req.body || {};
      const pool = await db.connect();
      const rs = await pool.request().input('email', sql.NVarChar, email).query('SELECT id,email FROM users WHERE email=@email');
      const genericMessage = authDemoMode()
        ? 'Da tao token dat lai mat khau.'
        : 'Neu email ton tai, he thong da tao yeu cau dat lai mat khau.';

      // Always return ok (do not reveal existence)
      if (rs.recordset.length === 0) {
        return res.json({ ok: true, message: genericMessage, deliveryMode: emailDeliveryMode() });
      }

      const userId = rs.recordset[0].id;
      const token = randomToken(32);
      const hash = sha256(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30m

      await pool
        .request()
        .input('user_id', sql.Int, userId)
        .input('token_hash', sql.NVarChar, hash)
        .input('expires_at', sql.DateTime, expiresAt)
        .query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (@user_id,@token_hash,@expires_at)');

      await audit({ actorUserId: userId, action: 'forgot_password', entity: 'user', entityId: userId, meta: {}, ip: req.ip });

      const delivery = await deliverAuthTokenMessage({
        type: 'forgot-password',
        to: rs.recordset[0].email,
        token,
        expiresAt,
        actionUrl: buildPublicUrl('/reset.html', { token })
      });

      res.json({
        ok: true,
        message: authDemoMode()
          ? genericMessage
          : deliveryStatusMessage(delivery.mode, genericMessage),
        deliveryMode: delivery.mode,
        expiresAt: delivery.expiresAt,
        actionUrl: delivery.actionUrl,
        token: delivery.token
      });
    } catch (err) {
      console.error('❌ FORGOT PASSWORD ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.post(
  '/reset-password',
  [
    body('token').isString().isLength({ min: 10 }).withMessage('Thiếu token'),
    body('new_password')
      .isLength({ min: 8, max: 72 }).withMessage('Mật khẩu mới phải từ 8-72 ký tự')
      .matches(/[A-Z]/).withMessage('Mật khẩu mới cần có ít nhất 1 chữ in hoa')
      .matches(/[a-z]/).withMessage('Mật khẩu mới cần có ít nhất 1 chữ thường')
      .matches(/[0-9]/).withMessage('Mật khẩu mới cần có ít nhất 1 chữ số')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const { token, new_password } = req.body || {};
      const hash = sha256(token);

      const pool = await db.connect();
      const rs = await pool
        .request()
        .input('token_hash', sql.NVarChar, hash)
        .query(
          `
          SELECT TOP (1) *
          FROM password_reset_tokens
          WHERE token_hash=@token_hash AND used_at IS NULL AND expires_at > GETDATE()
          ORDER BY id DESC
          `
        );
      if (rs.recordset.length === 0) return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });

      const row = rs.recordset[0];
      const newHash = bcrypt.hashSync(new_password, 10);

      await pool.request().input('id', sql.Int, row.user_id).input('pwd', sql.NVarChar, newHash).query('UPDATE users SET password=@pwd WHERE id=@id');
      await pool.request().input('id', sql.Int, row.id).query('UPDATE password_reset_tokens SET used_at=GETDATE() WHERE id=@id');

      // Revoke all refresh tokens for this user to force re-login
      await revokeAllRefreshTokensForUser(row.user_id);

      await audit({ actorUserId: row.user_id, action: 'reset_password', entity: 'user', entityId: row.user_id, meta: {}, ip: req.ip });
      res.json({ ok: true });
    } catch (err) {
      console.error('❌ RESET PASSWORD ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// =============================
// 2FA (TOTP)
// =============================
router.post('/2fa/setup', verify, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request().input('id', sql.Int, req.user.id).query('SELECT email,twofa_enabled FROM users WHERE id=@id');
    if (rs.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
    if (rs.recordset[0].twofa_enabled) return res.status(409).json({ message: '2FA đã bật' });

    const email = rs.recordset[0].email;
    const secret = speakeasy.generateSecret({ name: `BeautyCare (${email})` });

    await pool
      .request()
      .input('id', sql.Int, req.user.id)
      .input('secret', sql.NVarChar, secret.base32)
      .query('UPDATE users SET twofa_secret=@secret WHERE id=@id');

    await audit({ actorUserId: req.user.id, action: '2fa_setup', entity: 'user', entityId: req.user.id, meta: {}, ip: req.ip });

    res.json({ ok: true, secret: secret.base32, otpauth_url: secret.otpauth_url });
  } catch (err) {
    console.error('❌ 2FA SETUP ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post(
  '/2fa/enable',
  verify,
  [body('otp').isString().isLength({ min: 6, max: 6 }).withMessage('Mã 2FA phải 6 số')],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const otp = String(req.body.otp);
      const pool = await db.connect();
      const rs = await pool.request().input('id', sql.Int, req.user.id).query('SELECT twofa_secret,twofa_enabled FROM users WHERE id=@id');
      if (rs.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
      if (rs.recordset[0].twofa_enabled) return res.status(409).json({ message: '2FA đã bật' });

      const secret = String(rs.recordset[0].twofa_secret || '');
      if (!secret) return res.status(400).json({ message: 'Chưa có secret. Hãy setup trước.' });

      const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: otp, window: 1 });
      if (!valid) return res.status(400).json({ message: 'Mã 2FA không đúng' });

      await pool.request().input('id', sql.Int, req.user.id).query('UPDATE users SET twofa_enabled=1 WHERE id=@id');
      await audit({ actorUserId: req.user.id, action: '2fa_enable', entity: 'user', entityId: req.user.id, meta: {}, ip: req.ip });
      res.json({ ok: true });
    } catch (err) {
      console.error('❌ 2FA ENABLE ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.post(
  '/2fa/disable',
  verify,
  [body('otp').isString().isLength({ min: 6, max: 6 }).withMessage('Mã 2FA phải 6 số')],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const otp = String(req.body.otp);
      const pool = await db.connect();
      const rs = await pool.request().input('id', sql.Int, req.user.id).query('SELECT twofa_secret,twofa_enabled FROM users WHERE id=@id');
      if (rs.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
      if (!rs.recordset[0].twofa_enabled) return res.status(409).json({ message: '2FA chưa bật' });

      const secret = String(rs.recordset[0].twofa_secret || '');
      const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: otp, window: 1 });
      if (!valid) return res.status(400).json({ message: 'Mã 2FA không đúng' });

      await pool.request().input('id', sql.Int, req.user.id).query("UPDATE users SET twofa_enabled=0, twofa_secret=NULL WHERE id=@id");
      await revokeAllRefreshTokensForUser(req.user.id); // force re-login on other devices
      await audit({ actorUserId: req.user.id, action: '2fa_disable', entity: 'user', entityId: req.user.id, meta: {}, ip: req.ip });
      res.json({ ok: true });
    } catch (err) {
      console.error('❌ 2FA DISABLE ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// =============================
// Change password (logout other sessions)
// =============================
router.post(
  '/change-password',
  verify,
  [
    body('current_password').isString().isLength({ min: 1 }).withMessage('Thiếu mật khẩu hiện tại'),
    body('new_password')
      .isString()
      .isLength({ min: 8, max: 200 }).withMessage('Mật khẩu mới tối thiểu 8 ký tự')
      .custom((v) => /[a-z]/.test(String(v)) && /[A-Z]/.test(String(v)) && /[0-9]/.test(String(v)))
      .withMessage('Mật khẩu mới phải có chữ hoa, chữ thường và số')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const current = String(req.body.current_password || '');
      const nextPw = String(req.body.new_password || '');

      const pool = await db.connect();
      const rs = await pool
        .request()
        .input('id', sql.Int, req.user.id)
        .query('SELECT TOP (1) id,password FROM users WHERE id=@id');

      if (rs.recordset.length === 0) return res.status(404).json({ message: 'User not found' });

      const row = rs.recordset[0];
      const ok = bcrypt.compareSync(current, row.password);
      if (!ok) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });

      const hash = bcrypt.hashSync(nextPw, 10);
      await pool
        .request()
        .input('id', sql.Int, req.user.id)
        .input('pw', sql.NVarChar, hash)
        .query('UPDATE users SET password=@pw WHERE id=@id');

      // Revoke refresh tokens so other sessions must re-login
      await revokeAllRefreshTokensForUser(req.user.id);

      // Clear cookies for this session too
      clearAuthCookies(res);
      newCsrf(res);

      await audit({
        actorUserId: req.user.id,
        action: 'change_password',
        entity: 'user',
        entityId: req.user.id,
        meta: {},
        ip: req.ip
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('❌ CHANGE PASSWORD ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
