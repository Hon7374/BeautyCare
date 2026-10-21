const express = require('express');
const db = require('../db');
const { verify } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions/my
router.get('/my', verify, async (req, res) => {
  try {
    const pool = await db.connect();
    const rs = await pool.request()
      .input('uid', db.sql.Int, req.user.id)
      .query(`
        /*
          Lịch sử giao dịch (50 bản ghi gần nhất)
          - Lấy trạng thái thực tế từ payments (created/pending/paid/failed/cancelled...)
          - Giữ tương thích: union thêm bảng transactions legacy (mặc định paid)
        */
        SELECT TOP (50)
          ref,
          source,
          payment_id,
          transaction_id,
          provider_ref,
          provider,
          purpose,
          original_price,
          discount,
          final_price,
          voucher_code,
          status,
          created_at,
          paid_at,
          currency,
          amount,
          service_id,
          service_name,
          duration_min,
          booking_id,
          booking_date,
          booking_time,
          booking_status,
          subscription_id,
          plan_name,
          plan_tier,
          duration_days
        FROM (
          SELECT
            p.provider_ref AS ref,
            'payment' AS source,
            p.id AS payment_id,
            NULL AS transaction_id,
            p.provider_ref,
            p.provider,
            p.purpose,
            CASE
              WHEN LOWER(ISNULL(p.purpose,''))='subscription_change' THEN p.amount
              ELSE COALESCE(o.original_price, mp.price, p.amount)
            END AS original_price,
            COALESCE(o.discount, 0) AS discount,
            CASE
              WHEN LOWER(ISNULL(p.purpose,''))='subscription_change' THEN p.amount
              ELSE COALESCE(o.final_price, p.amount)
            END AS final_price,
            o.voucher_code,
            LOWER(ISNULL(p.status,'created')) AS status,
            COALESCE(p.paid_at, p.created_at, o.paid_at, o.created_at) AS created_at,
            p.paid_at,
            p.currency,
            p.amount,
            s.id AS service_id,
            s.name AS service_name,
            s.duration_min,
            COALESCE(o.booking_id, p.booking_id, b.id) AS booking_id,
            b.booking_date,
            b.booking_time,
            b.status AS booking_status,
            sub.id AS subscription_id,
            mp.name AS plan_name,
            mp.tier AS plan_tier,
            mp.duration_days
          FROM payments p
          LEFT JOIN orders o ON o.id = p.order_id
          LEFT JOIN services s ON s.id = o.service_id
          LEFT JOIN bookings b ON b.id = COALESCE(o.booking_id, p.booking_id)
          LEFT JOIN subscriptions sub ON sub.id = p.subscription_id
          LEFT JOIN membership_plans mp ON mp.id = sub.plan_id
          WHERE p.user_id=@uid

          UNION ALL

          SELECT
            CONCAT('LEGACY-', t.id) AS ref,
            'legacy' AS source,
            NULL AS payment_id,
            t.id AS transaction_id,
            NULL AS provider_ref,
            'legacy' AS provider,
            'legacy' AS purpose,
            t.original_price,
            t.discount,
            t.final_price,
            t.voucher_code,
            'paid' AS status,
            t.created_at,
            t.created_at AS paid_at,
            'VND' AS currency,
            t.final_price AS amount,
            NULL AS service_id,
            NULL AS service_name,
            NULL AS duration_min,
            NULL AS booking_id,
            NULL AS booking_date,
            NULL AS booking_time,
            NULL AS booking_status,
            NULL AS subscription_id,
            NULL AS plan_name,
            NULL AS plan_tier,
            NULL AS duration_days
          FROM transactions t
          WHERE t.user_id=@uid
        ) x
        ORDER BY created_at DESC, payment_id DESC, transaction_id DESC
      `);
    res.json(rs.recordset);
  } catch (err) {
    console.error('❌ TRANSACTIONS ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
