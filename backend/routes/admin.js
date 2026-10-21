const router = require('express').Router();
const { body, param, validationResult } = require('express-validator');
const db = require('../db');
const { verify, admin } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const {
  SERVICE_SELECT_FIELDS,
  ensureServiceSchema,
  normalizeService,
  normalizeServiceInput,
  validateServiceInput,
  bindServiceInput
} = require('../utils/serviceModel');
const { saveServiceImageUpload } = require('../utils/serviceImageUpload');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array()[0]?.msg || 'Dữ liệu không hợp lệ';
    res.status(400).json({ message: msg, errors: errors.array() });
    return false;
  }
  return true;
}

const ADMIN_USER_SELECT = `
  u.id,
  u.name,
  u.phone,
  u.email,
  u.role,
  u.member,
  u.member_expires_at,
  u.email_verified,
  u.twofa_enabled,
  (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS bookings_count,
  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count,
  (SELECT COUNT(*) FROM payments p WHERE p.user_id = u.id) AS payments_count,
  (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id = u.id) AS subscriptions_count,
  (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) AS transactions_count
`;

function normalizePhone(raw) {
  return String(raw || '').replace(/\D+/g, '').trim();
}

function isValidPhone(raw) {
  const phone = normalizePhone(raw);
  return phone.startsWith('0') && (phone.length === 10 || phone.length === 11);
}

function normalizeNullableEmail(raw) {
  if (raw === null || typeof raw === 'undefined') return null;
  const text = String(raw).trim().toLowerCase();
  return text || null;
}

function parseOptionalDateTime(raw) {
  if (raw === null || typeof raw === 'undefined' || raw === '') return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeAdminUser(row = {}) {
  return {
    id: Number(row.id || 0),
    name: String(row.name || '').trim(),
    phone: String(row.phone || '').trim(),
    email: row.email ? String(row.email).trim() : null,
    role: String(row.role || 'user').trim().toLowerCase(),
    member: String(row.member || 'silver').trim().toLowerCase(),
    member_expires_at: row.member_expires_at || null,
    email_verified: Boolean(row.email_verified),
    twofa_enabled: Boolean(row.twofa_enabled),
    bookings_count: Number(row.bookings_count || 0),
    orders_count: Number(row.orders_count || 0),
    payments_count: Number(row.payments_count || 0),
    subscriptions_count: Number(row.subscriptions_count || 0),
    transactions_count: Number(row.transactions_count || 0)
  };
}

async function fetchAdminUser(pool, userId) {
  const rs = await pool.request().input('id', db.sql.Int, Number(userId)).query(`
    SELECT ${ADMIN_USER_SELECT}
    FROM users u
    WHERE u.id=@id
  `);
  return rs.recordset?.[0] ? normalizeAdminUser(rs.recordset[0]) : null;
}

// ===== USERS =====
router.get('/users', verify, admin, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request().query(`
      SELECT ${ADMIN_USER_SELECT}
      FROM users u
      ORDER BY u.id ASC
    `);
    res.json((rs.recordset || []).map(normalizeAdminUser));
  } catch (err) {
    console.error('❌ ADMIN USERS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put(
  '/users/:id',
  verify,
  admin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID khong hop le'),
    body('role').optional().isIn(['user', 'admin']).withMessage('role khong hop le'),
    body('member').optional().isIn(['silver', 'gold', 'premium']).withMessage('member khong hop le')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const userId = Number(req.params.id);
      const pool = await db.connect();
      const current = await fetchAdminUser(pool, userId);
      if (!current) return res.status(404).json({ message: 'Khong tim thay nguoi dung' });

      const bodyData = req.body || {};
      const nextName = typeof bodyData.name === 'string' ? String(bodyData.name).trim() : current.name;
      const nextPhone = Object.prototype.hasOwnProperty.call(bodyData, 'phone') ? normalizePhone(bodyData.phone) : current.phone;
      const nextEmail = Object.prototype.hasOwnProperty.call(bodyData, 'email') ? normalizeNullableEmail(bodyData.email) : current.email;
      const nextRole = String(bodyData.role || current.role || 'user').trim().toLowerCase();
      const nextMember = String(bodyData.member || current.member || 'silver').trim().toLowerCase();

      let nextMemberExpiresAt = current.member_expires_at || null;
      if (
        Object.prototype.hasOwnProperty.call(bodyData, 'memberExpiresAt') ||
        Object.prototype.hasOwnProperty.call(bodyData, 'member_expires_at')
      ) {
        const rawDate = Object.prototype.hasOwnProperty.call(bodyData, 'memberExpiresAt')
          ? bodyData.memberExpiresAt
          : bodyData.member_expires_at;
        if (rawDate) {
          nextMemberExpiresAt = parseOptionalDateTime(rawDate);
          if (!nextMemberExpiresAt) return res.status(400).json({ message: 'memberExpiresAt khong hop le' });
        } else {
          nextMemberExpiresAt = null;
        }
      }

      if (!nextName || nextName.length < 2 || nextName.length > 100) {
        return res.status(400).json({ message: 'Ho ten phai tu 2-100 ky tu' });
      }
      if (!isValidPhone(nextPhone)) {
        return res.status(400).json({ message: 'So dien thoai khong hop le' });
      }
      if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        return res.status(400).json({ message: 'Email khong hop le' });
      }
      if (!['user', 'admin'].includes(nextRole)) {
        return res.status(400).json({ message: 'role khong hop le' });
      }
      if (!['silver', 'gold', 'premium'].includes(nextMember)) {
        return res.status(400).json({ message: 'member khong hop le' });
      }
      if (userId === Number(req.user.id) && nextRole !== current.role) {
        return res.status(400).json({ message: 'Khong the tu doi role cua chinh ban' });
      }

      if (current.role === 'admin' && nextRole !== 'admin') {
        const adminCountRs = await pool.request().query("SELECT COUNT(*) AS total FROM users WHERE role='admin'");
        const adminCount = Number(adminCountRs.recordset?.[0]?.total || 0);
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Khong the ha cap admin cuoi cung' });
        }
      }

      if (nextPhone !== current.phone) {
        const dupPhone = await pool
          .request()
          .input('id', db.sql.Int, userId)
          .input('phone', db.sql.NVarChar, nextPhone)
          .query('SELECT id FROM users WHERE phone=@phone AND id<>@id');
        if (dupPhone.recordset.length > 0) return res.status(409).json({ message: 'So dien thoai da ton tai' });
      }

      if (nextEmail !== current.email && nextEmail) {
        const dupEmail = await pool
          .request()
          .input('id', db.sql.Int, userId)
          .input('email', db.sql.NVarChar, nextEmail)
          .query('SELECT id FROM users WHERE email=@email AND id<>@id');
        if (dupEmail.recordset.length > 0) return res.status(409).json({ message: 'Email da ton tai' });
      }

      if (nextMember === 'silver') nextMemberExpiresAt = null;
      const emailVerified = nextEmail && nextEmail === current.email ? (current.email_verified ? 1 : 0) : 0;

      await pool
        .request()
        .input('id', db.sql.Int, userId)
        .input('name', db.sql.NVarChar, nextName)
        .input('phone', db.sql.NVarChar, nextPhone)
        .input('email', db.sql.NVarChar, nextEmail)
        .input('email_verified', db.sql.Bit, emailVerified)
        .input('role', db.sql.NVarChar, nextRole)
        .input('member', db.sql.NVarChar, nextMember)
        .input('member_expires_at', db.sql.DateTime, nextMemberExpiresAt)
        .query(`
          UPDATE users
          SET
            name=@name,
            phone=@phone,
            email=@email,
            email_verified=@email_verified,
            role=@role,
            member=@member,
            member_expires_at=@member_expires_at
          WHERE id=@id
        `);

      const updated = await fetchAdminUser(pool, userId);

      await audit({
        actorUserId: req.user.id,
        action: 'update',
        entity: 'user',
        entityId: userId,
        meta: {
          name: nextName,
          phone: nextPhone,
          email: nextEmail,
          role: nextRole,
          member: nextMember,
          member_expires_at: nextMemberExpiresAt
        },
        ip: req.ip
      });

      res.json({ ok: true, user: updated });
    } catch (err) {
      console.error('ADMIN UPDATE USER ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.delete(
  '/users/:id',
  verify,
  admin,
  [param('id').isInt({ min: 1 }).withMessage('ID khong hop le')],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const userId = Number(req.params.id);
      if (userId === Number(req.user.id)) {
        return res.status(400).json({ message: 'Khong the xoa chinh ban' });
      }

      const pool = await db.connect();
      const current = await fetchAdminUser(pool, userId);
      if (!current) return res.status(404).json({ message: 'Khong tim thay nguoi dung' });

      if (current.role === 'admin') {
        const adminCountRs = await pool.request().query("SELECT COUNT(*) AS total FROM users WHERE role='admin'");
        const adminCount = Number(adminCountRs.recordset?.[0]?.total || 0);
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Khong the xoa admin cuoi cung' });
        }
      }

      const removed = {};
      removed.payment_events = (
        await pool.request().input('id', db.sql.Int, userId).query(
          'DELETE FROM payment_events WHERE payment_id IN (SELECT id FROM payments WHERE user_id=@id)'
        )
      ).rowsAffected?.[0] || 0;
      removed.payments = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM payments WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.orders = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM orders WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.bookings = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM bookings WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.subscriptions = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM subscriptions WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.transactions = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM transactions WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.refresh_tokens = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM refresh_tokens WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.revoked_tokens = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM revoked_tokens WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.password_reset_tokens = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM password_reset_tokens WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.email_verify_tokens = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM email_verify_tokens WHERE user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.audit_logs = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM audit_logs WHERE actor_user_id=@id')
      ).rowsAffected?.[0] || 0;
      removed.users = (
        await pool.request().input('id', db.sql.Int, userId).query('DELETE FROM users WHERE id=@id')
      ).rowsAffected?.[0] || 0;

      await audit({
        actorUserId: req.user.id,
        action: 'delete',
        entity: 'user',
        entityId: userId,
        meta: {
          deletedUser: {
            id: current.id,
            name: current.name,
            email: current.email,
            role: current.role
          },
          removed
        },
        ip: req.ip
      });

      res.json({ ok: true, removed });
    } catch (err) {
      console.error('ADMIN DELETE USER ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ===== SERVICES =====
router.get('/services', verify, admin, async (req, res) => {
  try {
    const pool = await db.connect();
    await ensureServiceSchema(pool);
    const rs = await pool.request().query(`
      SELECT ${SERVICE_SELECT_FIELDS}
      FROM services
      ORDER BY id ASC
    `);
    res.json((rs.recordset || []).map(normalizeService));
  } catch (err) {
    console.error('❌ ADMIN SERVICES ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/services', verify, admin, async (req, res) => {
  try {
    const service = normalizeServiceInput(req.body || {});
    const message = validateServiceInput(service);
    if (message) return res.status(400).json({ message });

    const pool = await db.connect();
    await ensureServiceSchema(pool);

    const rs = await bindServiceInput(pool.request(), service).query(`
      INSERT INTO services (
        name,
        price,
        description,
        category,
        duration_min,
        image_url,
        short_description,
        detail_description,
        benefits_json,
        preparation_notes_json,
        aftercare_notes_json,
        faqs_json,
        payment_methods_json,
        promotion_note,
        status,
        related_service_ids_json
      )
      OUTPUT INSERTED.id
      VALUES (
        @name,
        @price,
        @description,
        @category,
        @duration_min,
        @image_url,
        @short_description,
        @detail_description,
        @benefits_json,
        @preparation_notes_json,
        @aftercare_notes_json,
        @faqs_json,
        @payment_methods_json,
        @promotion_note,
        @status,
        @related_service_ids_json
      )
    `);

    const id = rs.recordset?.[0]?.id;
    await audit({
      actorUserId: req.user.id,
      action: 'create',
      entity: 'service',
      entityId: id,
      meta: service,
      ip: req.ip
    });

    res.status(201).json({ id });
  } catch (err) {
    console.error('❌ ADMIN ADD SERVICE ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/services/upload-image', verify, admin, async (req, res) => {
  try {
    const upload = await saveServiceImageUpload(req.body || {});

    await audit({
      actorUserId: req.user.id,
      action: 'upload',
      entity: 'service_image',
      entityId: upload.fileName,
      meta: {
        url: upload.url,
        bytes: upload.bytes,
        mimeType: upload.mimeType
      },
      ip: req.ip
    });

    res.status(201).json({
      url: upload.url,
      fileName: upload.fileName,
      bytes: upload.bytes,
      mimeType: upload.mimeType
    });
  } catch (err) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.error('❌ ADMIN UPLOAD SERVICE IMAGE ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put(
  '/services/:id',
  verify,
  admin,
  [param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ')],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const id = Number(req.params.id);
      const service = normalizeServiceInput(req.body || {});
      const message = validateServiceInput(service);
      if (message) return res.status(400).json({ message });

      const pool = await db.connect();
      await ensureServiceSchema(pool);

      const found = await pool.request().input('id', db.sql.Int, id).query('SELECT id FROM services WHERE id=@id');
      if (found.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });

      await bindServiceInput(pool.request(), service)
        .input('id', db.sql.Int, id)
        .query(`
          UPDATE services
          SET
            name=@name,
            price=@price,
            description=@description,
            category=@category,
            duration_min=@duration_min,
            image_url=@image_url,
            short_description=@short_description,
            detail_description=@detail_description,
            benefits_json=@benefits_json,
            preparation_notes_json=@preparation_notes_json,
            aftercare_notes_json=@aftercare_notes_json,
            faqs_json=@faqs_json,
            payment_methods_json=@payment_methods_json,
            promotion_note=@promotion_note,
            status=@status,
            related_service_ids_json=@related_service_ids_json
          WHERE id=@id
        `);

      await audit({
        actorUserId: req.user.id,
        action: 'update',
        entity: 'service',
        entityId: id,
        meta: service,
        ip: req.ip
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('❌ ADMIN UPDATE SERVICE ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.delete(
  '/services/:id',
  verify,
  admin,
  [param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ')],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const id = Number(req.params.id);
      const pool = await db.connect();
      await pool.request().input('id', db.sql.Int, id).query('DELETE FROM services WHERE id=@id');

      await audit({
        actorUserId: req.user.id,
        action: 'delete',
        entity: 'service',
        entityId: id,
        meta: null,
        ip: req.ip
      });

      res.sendStatus(200);
    } catch (err) {
      console.error('❌ ADMIN DELETE SERVICE ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ===== VOUCHERS =====
router.get('/vouchers', verify, admin, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request().query('SELECT id, code, discount, expired_at FROM vouchers ORDER BY id DESC');
    res.json(rs.recordset);
  } catch (err) {
    console.error('❌ ADMIN VOUCHERS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post(
  '/vouchers',
  verify,
  admin,
  [
    body('code')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Mã voucher phải từ 3-50 ký tự')
      .matches(/^[A-Za-z0-9_-]+$/)
      .withMessage('Mã voucher chỉ gồm chữ, số, _ hoặc -'),
    body('discount').isInt({ min: 1, max: 100 }).withMessage('discount phải trong khoảng 1-100'),
    body('expired_at').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('expired_at phải là ISO date')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const { code, discount, expired_at } = req.body || {};
      const normCode = String(code).trim().toUpperCase();

      const pool = await db.connect();
      const existed = await pool
        .request()
        .input('code', db.sql.NVarChar, normCode)
        .query('SELECT id FROM vouchers WHERE code=@code');
      if (existed.recordset.length > 0) {
        return res.status(409).json({ message: 'Mã voucher đã tồn tại' });
      }

      const rs = await pool
        .request()
        .input('code', db.sql.NVarChar, normCode)
        .input('discount', db.sql.Int, Number(discount))
        .input('expired_at', db.sql.Date, expired_at ? new Date(expired_at) : null)
        .query('INSERT INTO vouchers (code, discount, expired_at) OUTPUT INSERTED.id VALUES (@code, @discount, @expired_at)');

      const id = rs.recordset?.[0]?.id;
      await audit({
        actorUserId: req.user.id,
        action: 'create',
        entity: 'voucher',
        entityId: id,
        meta: { code: normCode, discount: Number(discount), expired_at: expired_at || null },
        ip: req.ip
      });

      res.status(201).json({ id });
    } catch (err) {
      console.error('❌ ADMIN ADD VOUCHER ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.put(
  '/vouchers/:code',
  verify,
  admin,
  [
    param('code')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Mã voucher cũ không hợp lệ')
      .matches(/^[A-Za-z0-9_-]+$/)
      .withMessage('Mã voucher cũ chỉ gồm chữ, số, _ hoặc -'),
    body('code')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Mã voucher phải từ 3-50 ký tự')
      .matches(/^[A-Za-z0-9_-]+$/)
      .withMessage('Mã voucher chỉ gồm chữ, số, _ hoặc -'),
    body('discount').isInt({ min: 1, max: 100 }).withMessage('discount phải trong khoảng 1-100'),
    body('expired_at').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('expired_at phải là ISO date')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const oldCode = String(req.params.code || '').trim().toUpperCase();
      const newCode = String(req.body.code || '').trim().toUpperCase();
      const discount = Number(req.body.discount);
      const expiredAt = req.body.expired_at || null;

      const pool = await db.connect();
      const found = await pool
        .request()
        .input('code', db.sql.NVarChar, oldCode)
        .query('SELECT id, code FROM vouchers WHERE code=@code');
      if (found.recordset.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy voucher' });
      }

      if (newCode !== oldCode) {
        const duplicated = await pool
          .request()
          .input('code', db.sql.NVarChar, newCode)
          .query('SELECT id FROM vouchers WHERE code=@code');
        if (duplicated.recordset.length > 0) {
          return res.status(409).json({ message: 'Mã voucher đã tồn tại' });
        }
      }

      await pool
        .request()
        .input('old_code', db.sql.NVarChar, oldCode)
        .input('new_code', db.sql.NVarChar, newCode)
        .input('discount', db.sql.Int, discount)
        .input('expired_at', db.sql.Date, expiredAt ? new Date(expiredAt) : null)
        .query('UPDATE vouchers SET code=@new_code, discount=@discount, expired_at=@expired_at WHERE code=@old_code');

      await audit({
        actorUserId: req.user.id,
        action: 'update',
        entity: 'voucher',
        entityId: newCode,
        meta: { oldCode, code: newCode, discount, expired_at: expiredAt },
        ip: req.ip
      });

      res.json({ ok: true, code: newCode });
    } catch (err) {
      console.error('❌ ADMIN UPDATE VOUCHER ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.delete(
  '/vouchers/:code',
  verify,
  admin,
  [param('code').trim().isLength({ min: 3, max: 50 }).withMessage('Mã voucher không hợp lệ')],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const code = String(req.params.code).trim();
      const pool = await db.connect();
      await pool.request().input('code', db.sql.NVarChar, code).query('DELETE FROM vouchers WHERE code=@code');

      await audit({
        actorUserId: req.user.id,
        action: 'delete',
        entity: 'voucher',
        entityId: code,
        meta: null,
        ip: req.ip
      });

      res.sendStatus(200);
    } catch (err) {
      console.error('❌ ADMIN DELETE VOUCHER ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ===== TRANSACTIONS (ADMIN VIEW) =====
router.get('/transactions', verify, admin, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request().query(`
      SELECT TOP (100)
        t.id,
        u.email AS user_email,
        t.original_price,
        t.discount,
        t.final_price,
        t.voucher_code,
        t.created_at
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC, t.id DESC
    `);
    res.json(rs.recordset);
  } catch (err) {
    console.error('❌ ADMIN TRANSACTIONS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== BOOKINGS (ADMIN VIEW) =====
router.get('/bookings', verify, admin, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request().query(`
      SELECT
        b.id,
        b.user_id,
        u.email AS user_email,
        u.name AS user_name,
        b.service_id,
        s.name AS service_name,
        b.booking_date,
        b.booking_time,
        b.status,
        b.note,
        b.admin_note,
        b.created_at
      FROM bookings b
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN services s ON s.id = b.service_id
      ORDER BY b.booking_date DESC, b.booking_time DESC, b.id DESC
    `);
    res.json(rs.recordset);
  } catch (err) {
    console.error('❌ ADMIN BOOKINGS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch(
  '/bookings/:id',
  verify,
  admin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
    body('status').isIn(['pending', 'confirmed', 'cancelled', 'completed']).withMessage('Trạng thái không hợp lệ'),
    body('admin_note').optional({ nullable: true }).isLength({ max: 255 }).withMessage('admin_note quá dài')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const id = Number(req.params.id);
      const { status, admin_note } = req.body || {};

      const pool = await db.connect();
      const rs = await pool.request().input('id', db.sql.Int, id).query('SELECT id FROM bookings WHERE id=@id');
      if (rs.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });

      await pool
        .request()
        .input('id', db.sql.Int, id)
        .input('st', db.sql.NVarChar, status)
        .input('an', db.sql.NVarChar, admin_note ? String(admin_note).slice(0, 255) : null)
        .query('UPDATE bookings SET status=@st, admin_note=@an WHERE id=@id');

      await audit({
        actorUserId: req.user.id,
        action: 'update',
        entity: 'booking',
        entityId: id,
        meta: { status, admin_note: admin_note || null },
        ip: req.ip
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('❌ ADMIN UPDATE BOOKING ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);



// ===== DISCOUNT POLICIES (ADMIN) =====
router.get('/discounts', verify, admin, async (req, res) => {
  try {
    const pool = await db.connect();
    const pr = await pool.request().query('SELECT tier, rate FROM discount_policies ORDER BY tier ASC');
    const sr = await pool
      .request()
      .query("SELECT [key], [value] FROM discount_settings WHERE [key] IN ('max_total_rate')");

    const policies = {};
    for (const row of pr.recordset || []) {
      policies[String(row.tier).toLowerCase()] = Number(row.rate);
    }
    const settings = { max_total_rate: 0.95 };
    for (const row of sr.recordset || []) {
      if (String(row.key).toLowerCase() === 'max_total_rate') settings.max_total_rate = Number(row.value);
    }

    res.json({ policies, settings });
  } catch (err) {
    console.error('❌ ADMIN DISCOUNTS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put(
  '/discounts',
  verify,
  admin,
  [
    body('policies.silver').optional().isFloat({ min: 0, max: 0.95 }).withMessage('silver rate không hợp lệ'),
    body('policies.gold').optional().isFloat({ min: 0, max: 0.95 }).withMessage('gold rate không hợp lệ'),
    body('policies.premium').optional().isFloat({ min: 0, max: 0.95 }).withMessage('premium rate không hợp lệ'),
    body('settings.max_total_rate').optional().isFloat({ min: 0, max: 0.95 }).withMessage('max_total_rate không hợp lệ')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const { policies = {}, settings = {} } = req.body || {};

      const pool = await db.connect();

      const tiers = ['silver', 'gold', 'premium'];
      for (const t of tiers) {
        if (policies[t] === undefined) continue;
        await pool
          .request()
          .input('tier', db.sql.NVarChar, t)
          .input('rate', db.sql.Decimal(5, 4), Number(policies[t]))
          .query(
            `
            INSERT INTO discount_policies (tier, rate)
            VALUES (@tier, @rate)
            ON DUPLICATE KEY UPDATE rate = VALUES(rate)
            `
          );
      }

      if (settings.max_total_rate !== undefined) {
        await pool
          .request()
          .input('k', db.sql.NVarChar, 'max_total_rate')
          .input('v', db.sql.NVarChar, String(settings.max_total_rate))
          .query(
            `
            INSERT INTO discount_settings ([key], [value])
            VALUES (@k, @v)
            ON DUPLICATE KEY UPDATE [value] = VALUES([value])
            `
          );
      }

      await audit({
        actorUserId: req.user.id,
        action: 'update',
        entity: 'discount_policy',
        entityId: 'global',
        meta: { policies, settings },
        ip: req.ip
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('❌ ADMIN UPDATE DISCOUNTS ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ===== SUBSCRIPTIONS (ADMIN) =====
router.get('/subscriptions', verify, admin, async (req, res) => {
  try {
    const status = (req.query.status ? String(req.query.status) : '').toLowerCase();
    const q = (req.query.q ? String(req.query.q) : '').trim();

    const pool = await db.connect();
    const rs = await pool
      .request()
      .input('status', db.sql.NVarChar, status || null)
      .input('q', db.sql.NVarChar, q ? `%${q}%` : null)
      .query(
        `
        SELECT TOP (300)
          s.id,
          s.status,
          s.start_at,
          s.end_at,
          s.auto_renew,
          s.provider,
          s.provider_ref,
          s.created_at,
          u.email AS user_email,
          u.name AS user_name,
          p.code AS plan_code,
          p.name AS plan_name,
          p.tier AS plan_tier,
          p.price AS plan_price,
          p.duration_days
        FROM subscriptions s
        JOIN users u ON u.id = s.user_id
        JOIN membership_plans p ON p.id = s.plan_id
        WHERE (@status IS NULL OR LOWER(s.status)=@status)
          AND (@q IS NULL OR u.email LIKE @q OR u.name LIKE @q OR p.code LIKE @q)
        ORDER BY s.created_at DESC, s.id DESC
        `
      );

    res.json(rs.recordset);
  } catch (err) {
    console.error('❌ ADMIN SUBSCRIPTIONS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch(
  '/subscriptions/:id',
  verify,
  admin,
  [
    param('id').isInt({ min: 1 }).withMessage('ID không hợp lệ'),
    body('status').optional().isIn(['pending', 'active', 'cancelled', 'expired']).withMessage('status không hợp lệ'),
    body('auto_renew').optional().isBoolean().withMessage('auto_renew không hợp lệ'),
    body('extend_days').optional().isInt({ min: 1, max: 3650 }).withMessage('extend_days không hợp lệ')
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;
      const id = Number(req.params.id);
      const { status, auto_renew, extend_days } = req.body || {};

      const pool = await db.connect();
      const sr = await pool
        .request()
        .input('id', db.sql.Int, id)
        .query(
          `
          SELECT s.*, u.id AS uid, u.member AS current_member, p.tier AS plan_tier, p.duration_days
          FROM subscriptions s
          JOIN users u ON u.id=s.user_id
          JOIN membership_plans p ON p.id=s.plan_id
          WHERE s.id=@id
          `
        );
      if (sr.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy subscription' });
      const sub = sr.recordset[0];

      // Update auto_renew
      if (auto_renew !== undefined) {
        await pool
          .request()
          .input('id', db.sql.Int, id)
          .input('ar', db.sql.Bit, auto_renew ? 1 : 0)
          .query('UPDATE subscriptions SET auto_renew=@ar, updated_at=GETDATE() WHERE id=@id');
      }

      // Extend end_at
      if (extend_days !== undefined) {
        await pool
          .request()
          .input('id', db.sql.Int, id)
          .input('d', db.sql.Int, Number(extend_days))
          .query(
            `
            UPDATE subscriptions
            SET end_at=CASE
              WHEN end_at IS NULL THEN DATEADD(day, @d, GETDATE())
              ELSE DATEADD(day, @d, end_at)
            END,
            updated_at=GETDATE()
            WHERE id=@id
            `
          );

        // Also extend user's membership expiry
        await pool
          .request()
          .input('uid', db.sql.Int, Number(sub.uid))
          .input('d', db.sql.Int, Number(extend_days))
          .query(
            `
            UPDATE users
            SET member_expires_at=CASE
              WHEN member_expires_at IS NULL THEN DATEADD(day, @d, GETDATE())
              ELSE DATEADD(day, @d, member_expires_at)
            END
            WHERE id=@uid
            `
          );
      }

      // Update status (and reflect to user membership where relevant)
      if (status !== undefined) {
        const st = String(status).toLowerCase();

        await pool
          .request()
          .input('id', db.sql.Int, id)
          .input('st', db.sql.NVarChar, st)
          .query('UPDATE subscriptions SET status=@st, updated_at=GETDATE() WHERE id=@id');

        if (st === 'active') {
          const days = Number(sub.duration_days) || 30;
          await pool
            .request()
            .input('uid', db.sql.Int, Number(sub.uid))
            .input('tier', db.sql.NVarChar, String(sub.plan_tier))
            .input('days', db.sql.Int, days)
            .query(
              `
              UPDATE users
              SET member=@tier,
                  member_expires_at=DATEADD(day, @days, GETDATE())
              WHERE id=@uid
              `
            );
        }

        if (st === 'cancelled' || st === 'expired') {
          // Revoke membership (demo choice). In real system, you may keep until end_at.
          await pool
            .request()
            .input('uid', db.sql.Int, Number(sub.uid))
            .query(
              `
              UPDATE users
              SET member='silver', member_expires_at=NULL
              WHERE id=@uid
              `
            );

          if (st === 'cancelled') {
            await pool
              .request()
              .input('id', db.sql.Int, id)
              .query("UPDATE subscriptions SET end_at=GETDATE(), updated_at=GETDATE() WHERE id=@id");
          }
        }
      }

      await audit({
        actorUserId: req.user.id,
        action: 'update',
        entity: 'subscription',
        entityId: id,
        meta: { status, auto_renew, extend_days },
        ip: req.ip
      });

      res.json({ ok: true });
    } catch (err) {
      console.error('❌ ADMIN UPDATE SUBSCRIPTION ERROR:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// ===== REPORTS (ADMIN) =====
function normalizeReportDays(raw) {
  const days = Number(raw || 30);
  if (!Number.isFinite(days)) return 30;
  return Math.max(1, Math.min(3650, Math.trunc(days)));
}

function reportDateKey(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value);
  const matched = text.match(/\d{4}-\d{2}-\d{2}/);
  return matched ? matched[0] : text.slice(0, 10);
}

router.get('/reports/revenue', verify, admin, async (req, res) => {
  try {
    const days = normalizeReportDays(req.query.days);
    const pool = await db.connect();

    const rs = await pool
      .request()
      .input('days', db.sql.Int, days)
      .query(
        `
        SELECT provider, purpose,
               COUNT(*) AS tx_count,
               SUM(amount) AS gross_amount
        FROM payments
        WHERE status='paid'
          AND created_at >= DATEADD(day, -@days, GETDATE())
        GROUP BY provider, purpose
        ORDER BY gross_amount DESC
        `
      );

    res.json({ days, rows: rs.recordset });
  } catch (err) {
    console.error('❌ ADMIN REPORT REVENUE ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/reports/revenue-trend', verify, admin, async (req, res) => {
  try {
    const days = normalizeReportDays(req.query.days);
    const pool = await db.connect();

    const paymentRs = await pool
      .request()
      .input('days', db.sql.Int, days)
      .query(
        `
        SELECT DATE(created_at) AS report_date,
               COUNT(*) AS tx_count,
               SUM(amount) AS gross_amount
        FROM payments
        WHERE status='paid'
          AND created_at >= DATEADD(day, -@days, GETDATE())
        GROUP BY DATE(created_at)
        ORDER BY report_date ASC
        `
      );

    const bookingRs = await pool
      .request()
      .input('days', db.sql.Int, days)
      .query(
        `
        SELECT DATE(created_at) AS report_date,
               COUNT(*) AS booking_count
        FROM bookings
        WHERE created_at >= DATEADD(day, -@days, GETDATE())
        GROUP BY DATE(created_at)
        ORDER BY report_date ASC
        `
      );

    const byDate = new Map();
    for (const row of paymentRs.recordset || []) {
      const date = reportDateKey(row.report_date);
      if (!date) continue;
      byDate.set(date, {
        date,
        gross_amount: Number(row.gross_amount || 0),
        tx_count: Number(row.tx_count || 0),
        booking_count: 0
      });
    }

    for (const row of bookingRs.recordset || []) {
      const date = reportDateKey(row.report_date);
      if (!date) continue;
      const current = byDate.get(date) || { date, gross_amount: 0, tx_count: 0, booking_count: 0 };
      current.booking_count = Number(row.booking_count || 0);
      byDate.set(date, current);
    }

    res.json({
      days,
      rows: Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)))
    });
  } catch (err) {
    console.error('❌ ADMIN REPORT REVENUE TREND ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/reports/overview', verify, admin, async (req, res) => {
  try {
    const days = normalizeReportDays(req.query.days);
    const pool = await db.connect();

    const p1 = await pool
      .request()
      .input('days', db.sql.Int, days)
      .query(
        `
        SELECT
          (SELECT COUNT(*) FROM users) AS users_total,
          (SELECT COUNT(*) FROM services) AS services_total,
          (SELECT COUNT(*) FROM vouchers) AS vouchers_total,
          (SELECT COUNT(*) FROM bookings WHERE created_at >= DATEADD(day, -@days, GETDATE())) AS bookings_recent,
          (SELECT COUNT(*) FROM orders WHERE created_at >= DATEADD(day, -@days, GETDATE())) AS orders_recent,
          (SELECT COUNT(*) FROM payments WHERE created_at >= DATEADD(day, -@days, GETDATE())) AS payments_recent,
          (SELECT COUNT(*) FROM payments WHERE status='paid' AND created_at >= DATEADD(day, -@days, GETDATE())) AS payments_paid_recent,
          (SELECT ISNULL(SUM(amount),0) FROM payments WHERE status='paid' AND created_at >= DATEADD(day, -@days, GETDATE())) AS revenue_paid_recent,
          (SELECT COUNT(*) FROM subscriptions WHERE status='active') AS subscriptions_active
        `
      );

    res.json({ days, ...p1.recordset[0] });
  } catch (err) {
    console.error('❌ ADMIN REPORT OVERVIEW ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
