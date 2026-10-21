// routes/bookings.js
const express = require('express');
const db = require('../db');
const { verify } = require('../middleware/auth');
const {
  sendBookingCreatedNotification,
  sendBookingConfirmationEmail
} = require('../utils/bookingMailer');
const { acquireMysqlNamedLock } = require('../utils/mysqlLocks');

const router = express.Router();

// Business rules: 09:00 → 19:00, each 30 minutes.
const OPEN_HOUR = 9;
const CLOSE_HOUR = 19;
const STEP_MIN = 30;

// Capacity per slot
const SLOT_CAPACITY = Math.max(
  1,
  Number.parseInt(process.env.BOOKING_CAPACITY || '3', 10) || 3
);

function buildAllowedSlots() {
  const out = [];
  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
    for (let m = 0; m < 60; m += STEP_MIN) {
      if (h === CLOSE_HOUR && m > 0) continue;
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}
const ALLOWED_SLOTS = buildAllowedSlots();

function isValidISODate(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
}

function isValidTime(t) {
  // Accept HH:MM or HH:MM:SS (24h)
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(t || '').trim());
}

function normalizeTimeToHHMMSS(t) {
  const raw = String(t || '').trim();
  if (!raw) return '';
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) return `${raw}:00`;
  if (/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(raw)) return raw;
  return raw;
}

function isAllowedSlot(timeHHMM) {
  return ALLOWED_SLOTS.includes(String(timeHHMM || '').trim());
}

/**
 * ✅ IMPORTANT (fix lệch ngày):
 * Không tạo Date object từ 'YYYY-MM-DD' để bind db.sql.Date.
 * Giữ date dạng string 'YYYY-MM-DD' và CAST trong SQL.
 */
function normalizeDateOnly(dateStr) {
  return String(dateStr || '').slice(0, 10);
}

/** ✅ Convert Date -> YYYY-MM-DD (UTC) (chỉ dùng khi đọc recordset) */
function toISODateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// =====================================================
// USER: CREATE BOOKING
// POST /api/bookings
// Body: { serviceId, date:'YYYY-MM-DD', time:'HH:MM', note? }
// (also accepts booking_date / booking_time)
// =====================================================
router.post('/', verify, async (req, res) => {
  try {
    const serviceId = Number(req.body?.serviceId);
    const date = normalizeDateOnly(req.body?.booking_date || req.body?.date);
    const time = String(req.body?.booking_time || req.body?.time || '').trim();
    const note = req.body?.note;

    if (!serviceId) return res.status(400).json({ message: 'Thiếu serviceId' });
    if (!isValidISODate(date)) return res.status(400).json({ message: 'Ngày không hợp lệ (YYYY-MM-DD)' });
    if (!isValidTime(time)) return res.status(400).json({ message: 'Giờ không hợp lệ (HH:MM hoặc HH:MM:SS)' });

    const timeHHMM = String(time).slice(0, 5);
    if (!isAllowedSlot(timeHHMM)) {
      return res.status(400).json({
        message: `Giờ đặt lịch chỉ cho phép từ ${ALLOWED_SLOTS[0]} đến ${ALLOWED_SLOTS[ALLOWED_SLOTS.length - 1]} (mỗi ${STEP_MIN} phút)`
      });
    }
    const timeHHMMSS = normalizeTimeToHHMMSS(time);

    // ✅ so sánh ngày bằng string ISO để không dính timezone
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (date < todayISO) return res.status(400).json({ message: 'Không thể đặt lịch cho ngày trong quá khứ' });

    const pool = await db.connect();

    const slotLockName = `beautycare:booking:${serviceId}:${date}:${timeHHMMSS}`;
    const releaseSlotLock = await acquireMysqlNamedLock(slotLockName, 10);
    if (!releaseSlotLock) {
      return res.status(503).json({ message: 'KhÃ´ng thá»ƒ khá»Ÿi táº¡o khÃ³a slot, vui lÃ²ng thá»­ láº¡i.' });
    }

    let newId;
    try {
    // service must exist
    const sRs = await pool.request()
      .input('sid', db.sql.Int, serviceId)
      .query('SELECT id, name FROM services WHERE id=@sid');
    if (sRs.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });

    // Capacity check for slot (per service/date/time)
    const cnt = await pool.request()
      .input('sid', db.sql.Int, serviceId)
      .input('d', db.sql.VarChar(10), date)
      .input('t', db.sql.VarChar(8), timeHHMMSS)
      .query(`
        SELECT COUNT(*) AS c
        FROM bookings
        WHERE service_id=@sid
          AND booking_date = CAST(@d AS date)
          AND booking_time = CAST(@t AS time(0))
          AND status IN ('pending','confirmed','paid')
      `);
    const booked = Number(cnt.recordset?.[0]?.c || 0);
    if (booked >= SLOT_CAPACITY) {
      return res.status(409).json({ message: 'Khung giờ này đã đầy. Vui lòng chọn giờ khác.' });
    }

    const ins = await pool.request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .input('sid', db.sql.Int, serviceId)
      .input('d', db.sql.VarChar(10), date)
      .input('t', db.sql.VarChar(8), timeHHMMSS)
      .input('note', db.sql.NVarChar, note ? String(note).slice(0, 255) : null)
      .query(`
        INSERT INTO bookings (user_id, service_id, booking_date, booking_time, note)
        OUTPUT INSERTED.id
        VALUES (@uid, @sid, CAST(@d AS date), CAST(@t AS time(0)), @note)
      `);

    newId = ins.recordset?.[0]?.id;
    } finally {
      await releaseSlotLock();
      await pool.request()
        .input('lock_name', db.sql.NVarChar, slotLockName.slice(0, 64))
        .query('SELECT RELEASE_LOCK(@lock_name) AS released')
        .catch(() => {});
    }
    try {
      const detailRs = await pool.request()
        .input('id', db.sql.Int, Number(newId))
        .query(`
          SELECT TOP (1)
            b.id,
            b.user_id,
            b.service_id,
            b.booking_date,
            b.booking_time,
            b.note,
            b.created_at,
            u.name AS user_name,
            u.phone AS user_phone,
            u.email AS user_email,
            s.name AS service_name
          FROM bookings b
          JOIN users u ON u.id = b.user_id
          JOIN services s ON s.id = b.service_id
          WHERE b.id=@id
        `);

      const row = detailRs.recordset?.[0];
      if (row) {
        const mailContext = {
          booking: {
            id: row.id,
            user_id: row.user_id,
            service_id: row.service_id,
            booking_date: row.booking_date,
            booking_time: row.booking_time,
            note: row.note,
            created_at: row.created_at
          },
          user: {
            id: row.user_id,
            name: row.user_name,
            phone: row.user_phone,
            email: row.user_email
          },
          service: {
            id: row.service_id,
            name: row.service_name
          }
        };

        // Delivery must not roll back a successfully-created appointment. Each
        // recipient is attempted independently so a missing admin address does
        // not prevent the customer confirmation (and vice versa).
        const deliveries = await Promise.allSettled([
          sendBookingConfirmationEmail(mailContext),
          sendBookingCreatedNotification(mailContext)
        ]);
        const [customerDelivery, adminDelivery] = deliveries;
        const customerMode = customerDelivery.status === 'fulfilled'
          ? customerDelivery.value?.mode
          : 'failed';
        const adminMode = adminDelivery.status === 'fulfilled'
          ? adminDelivery.value?.mode
          : 'failed';
        console.info(
          `[bookings] booking_email_delivery bookingId=${newId} customer=${customerMode} admin=${adminMode}`
        );

        deliveries
          .filter((delivery) => delivery.status === 'rejected')
          .forEach((delivery) => {
            console.error('❌ BOOKING NOTIFICATION EMAIL ERROR:', delivery.reason?.message || delivery.reason);
          });
      }
    } catch (mailErr) {
      console.error('❌ BOOKING NOTIFICATION EMAIL ERROR:', mailErr?.message || mailErr);
    }

    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('❌ CREATE BOOKING ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================================================
// USER: AVAILABILITY (by service + date)
// GET /api/bookings/availability?serviceId=1&date=YYYY-MM-DD
// =====================================================
router.get('/availability', verify, async (req, res) => {
  try {
    const serviceId = Number(req.query.serviceId);
    const date = normalizeDateOnly(req.query.date);

    if (!serviceId) return res.status(400).json({ message: 'Thiếu serviceId' });
    if (!isValidISODate(date)) return res.status(400).json({ message: 'Ngày không hợp lệ (YYYY-MM-DD)' });

    const pool = await db.connect();

    const rs = await pool.request()
      .input('sid', db.sql.Int, serviceId)
      .input('d', db.sql.VarChar(10), date)
      .query(`
        SELECT booking_time, COUNT(*) AS c
        FROM bookings
        WHERE service_id=@sid
          AND booking_date = CAST(@d AS date)
          AND status IN ('pending','confirmed','paid')
        GROUP BY booking_time
      `);

    const map = new Map();
    rs.recordset.forEach((r) => {
      const t = String(r.booking_time).match(/(\d{2}:\d{2})/)?.[1] || String(r.booking_time).slice(0, 5);
      map.set(t, Number(r.c || 0));
    });

    const slots = ALLOWED_SLOTS.map((t) => {
      const booked = map.get(t) || 0;
      const remaining = Math.max(0, SLOT_CAPACITY - booked);
      return { time: t, booked, remaining, available: remaining > 0 };
    });

    res.json({ serviceId, date, capacity: SLOT_CAPACITY, slots });
  } catch (err) {
    console.error('❌ AVAILABILITY ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================================================
// USER: AVAILABILITY CALENDAR (by service + date range)
// GET /api/bookings/availability-calendar?serviceId=1&from=YYYY-MM-DD&to=YYYY-MM-DD
// =====================================================
router.get('/availability-calendar', verify, async (req, res) => {
  try {
    const serviceId = Number(req.query.serviceId ?? req.query.service_id ?? req.query.sid);
    const from = normalizeDateOnly(req.query.from);
    const to = normalizeDateOnly(req.query.to);

    if (!Number.isFinite(serviceId) || serviceId <= 0) {
      return res.status(400).json({ message: 'Thiếu serviceId' });
    }
    if (!isValidISODate(from) || !isValidISODate(to)) {
      return res.status(400).json({ message: 'from/to không hợp lệ (YYYY-MM-DD)' });
    }
    if (to < from) return res.status(400).json({ message: 'to phải >= from' });

    // Limit range to avoid heavy query
    const maxDays = 62;
    const fromMs = Date.parse(`${from}T00:00:00Z`);
    const toMs = Date.parse(`${to}T00:00:00Z`);
    const diffDays = Math.floor((toMs - fromMs) / (24 * 3600 * 1000)) + 1;
    if (diffDays > maxDays) {
      return res.status(400).json({ message: `Khoảng ngày quá dài (tối đa ${maxDays} ngày)` });
    }

    const pool = await db.connect();

    const rs = await pool.request()
      .input('sid', db.sql.Int, serviceId)
      .input('fromD', db.sql.VarChar(10), from)
      .input('toD', db.sql.VarChar(10), to)
      .query(`
        SELECT booking_date, booking_time, COUNT(*) AS c
        FROM bookings
        WHERE service_id=@sid
          AND booking_date >= CAST(@fromD AS date)
          AND booking_date <= CAST(@toD AS date)
          AND status IN ('pending','confirmed','paid')
        GROUP BY booking_date, booking_time
      `);

    // dateStr -> Map(time -> count)
    const dayMap = new Map();
    rs.recordset.forEach(r => {
      const d = toISODateStr(r.booking_date);
      const t = String(r.booking_time).match(/(\d{2}:\d{2})/)?.[1] || String(r.booking_time).slice(0, 5);
      if (!dayMap.has(d)) dayMap.set(d, new Map());
      dayMap.get(d).set(t, Number(r.c || 0));
    });

    const days = [];
    for (let i = 0; i < diffDays; i++) {
      const d = new Date(fromMs + i * 24 * 3600 * 1000);
      const dateStr = toISODateStr(d);

      const timeCounts = dayMap.get(dateStr) || new Map();

      let availableSlots = 0;
      let remainingTotal = 0;

      ALLOWED_SLOTS.forEach(t => {
        const booked = timeCounts.get(t) || 0;
        const remaining = Math.max(0, SLOT_CAPACITY - booked);
        if (remaining > 0) availableSlots += 1;
        remainingTotal += remaining;
      });

      days.push({
        date: dateStr,
        availableSlots,
        remainingTotal,
        isFull: availableSlots === 0
      });
    }

    res.json({ serviceId, from, to, capacity: SLOT_CAPACITY, days });
  } catch (err) {
    console.error('❌ AVAILABILITY CALENDAR ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================================================
// USER: LIST MY BOOKINGS (ẩn cancelled)
// GET /api/bookings/my
// =====================================================
router.get('/my', verify, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request()
      .input('uid', db.sql.Int, Number(req.user.id))
      .query(`
        SELECT
          b.id,
          b.service_id,
          s.name AS service_name,
          s.price AS service_price,
          b.booking_date,
          b.booking_time,
          b.status,
          b.note,
          b.admin_note,
          b.created_at,

          o.id AS order_id,
          o.status AS order_status,
          p.provider_ref AS payment_ref,
          p.status AS payment_status,
          p.provider AS payment_provider,
          p.paid_at AS payment_paid_at
        FROM bookings b
        LEFT JOIN services s ON s.id = b.service_id
        LEFT JOIN orders o ON o.id = (
          SELECT o2.id
          FROM orders o2
          WHERE o2.booking_id = b.id AND o2.user_id = b.user_id
          ORDER BY o2.id DESC
          LIMIT 1
        )
        LEFT JOIN payments p ON p.id = (
          SELECT p2.id
          FROM payments p2
          WHERE p2.order_id = o.id
          ORDER BY p2.id DESC
          LIMIT 1
        )
        WHERE b.user_id=@uid AND LOWER(IFNULL(b.status,'')) <> 'cancelled'
        ORDER BY b.booking_date DESC, b.booking_time DESC, b.id DESC
      `);
    res.json(rs.recordset);
  } catch (err) {
    console.error('❌ MY BOOKINGS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================================================
// USER: GET MY BOOKING (for payment page)
// GET /api/bookings/:id
// =====================================================
router.get('/:id', verify, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

    const pool = await db.connect();

    const queryFull = `
      SELECT TOP 1
        b.id,
        b.user_id,
        b.service_id,
        b.booking_date,
        b.booking_time,
        b.note,
        b.status,
        b.amount,
        b.discount_amount,
        b.total_amount,
        b.created_at,
        s.name AS service_name,
        s.price AS service_price,
        p.status AS payment_status,
        p.provider AS payment_provider,
        p.txn_ref,
        p.created_at AS payment_created_at
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.id = @id AND b.user_id = @user_id
      ORDER BY p.created_at DESC
    `;

    const queryNoPayments = `
      SELECT TOP 1
        b.id,
        b.user_id,
        b.service_id,
        b.booking_date,
        b.booking_time,
        b.note,
        b.status,
        b.amount,
        b.discount_amount,
        b.total_amount,
        b.created_at,
        s.name AS service_name,
        s.price AS service_price
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.id = @id AND b.user_id = @user_id
    `;

    const queryMinimal = `
      SELECT TOP 1
        b.id,
        b.user_id,
        b.service_id,
        b.booking_date,
        b.booking_time,
        b.note,
        b.status,
        b.created_at,
        s.name AS service_name,
        s.price AS service_price
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE b.id = @id AND b.user_id = @user_id
    `;

      const run = async (sqlText) => {
      return pool.request()
        .input('id', db.sql.Int, Number(id))
        .input('user_id', db.sql.Int, Number(req.user.id))
        .query(sqlText);
    };

    let record;
    try {
      const r = await run(queryFull);
      record = r.recordset?.[0];
    } catch (e1) {
      try {
        const r = await run(queryNoPayments);
        record = r.recordset?.[0];
      } catch (e2) {
        const r = await run(queryMinimal);
        record = r.recordset?.[0];
      }
    }

    if (!record) return res.status(404).json({ message: 'Booking not found' });

    // Normalize pricing
    const servicePrice = Number(record.service_price ?? 0);
    const amount = Number(record.amount ?? servicePrice);
    const discountAmount = Number(record.discount_amount ?? 0);
    const totalAmount = Number(record.total_amount ?? Math.max(0, amount - discountAmount));

    record.amount = amount;
    record.discount_amount = discountAmount;
    record.total_amount = totalAmount;

    return res.json(record);
  } catch (err) {
    console.error('GET /bookings/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// =====================================================
// USER: CANCEL
// PATCH /api/bookings/:id/cancel
// =====================================================
router.patch('/:id/cancel', verify, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await db.connect();

    const rs = await pool.request()
      .input('id', db.sql.Int, id)
      .input('uid', db.sql.Int, Number(req.user.id))
      .query('SELECT id, status FROM bookings WHERE id=@id AND user_id=@uid');

    if (rs.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });

    const status = String(rs.recordset[0].status || '').toLowerCase();
    if (!['pending', 'confirmed'].includes(status)) {
      return res.status(400).json({ message: 'Không thể hủy lịch ở trạng thái hiện tại' });
    }

    // Preserve the booking audit trail.  A hard delete fails once a payment
    // attempt or order references this booking, and it also makes support and
    // refund investigations impossible.
    await pool.request()
      .input('id', db.sql.Int, id)
      .input('uid', db.sql.Int, Number(req.user.id))
      .query("UPDATE payments SET status='cancelled' WHERE booking_id=@id AND user_id=@uid AND LOWER(status) IN ('created','pending')");

    await pool.request()
      .input('id', db.sql.Int, id)
      .input('uid', db.sql.Int, Number(req.user.id))
      .query("UPDATE orders SET status='cancelled' WHERE booking_id=@id AND user_id=@uid AND LOWER(status) IN ('created','pending')");

    await pool.request()
      .input('id', db.sql.Int, id)
      .input('uid', db.sql.Int, Number(req.user.id))
      .query("UPDATE bookings SET status='cancelled' WHERE id=@id AND user_id=@uid");

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ CANCEL BOOKING ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
