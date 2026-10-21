const express = require('express');
const db = require('../db');
const { verify } = require('../middleware/auth');
const { calculateServiceTotal } = require('../utils/pricing');

const router = express.Router();



// POST /api/payment/preview
// Body: { serviceId: number, voucherCode?: string }
router.post('/preview', verify, async (req, res) => {
  try {
    const { serviceId, voucherCode } = req.body || {};
    if (!serviceId) return res.status(400).json({ message: 'Thiếu serviceId' });

    const pool = await db.connect();
    const result = await calculateServiceTotal(pool, req.user.id, serviceId, voucherCode);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (err.message === 'SERVICE_NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    console.error('❌ PAYMENT PREVIEW ERROR:', err);
    res.status(status).json({ message: 'Server error' });
  }
});

// POST /api/payment
// Body: { serviceId: number, voucherCode?: string }
router.post('/', verify, async (req, res) => {
  try {
    const { serviceId, voucherCode } = req.body || {};
    if (!serviceId) return res.status(400).json({ message: 'Thiếu serviceId' });

    const pool = await db.connect();
    const result = await calculateServiceTotal(pool, req.user.id, serviceId, voucherCode);

    await pool.request()
      .input('uid', db.sql.Int, req.user.id)
      .input('op', db.sql.Int, result.originalPrice)
      .input('dc', db.sql.Int, result.discountAmount)
      .input('fp', db.sql.Int, result.finalPrice)
      .input('vc', db.sql.NVarChar, result.voucherCode)
      .query(`
        INSERT INTO transactions (user_id, original_price, discount, final_price, voucher_code)
        VALUES (@uid, @op, @dc, @fp, @vc)
      `);

    res.json({
      service: { id: result.service.id, name: result.service.name },
      member: result.user.member,
      originalPrice: result.originalPrice,
      discountAmount: result.discountAmount,
      finalPrice: result.finalPrice,
      voucherCode: result.voucherCode
    });
  } catch (err) {
    if (err.message === 'SERVICE_NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy dịch vụ' });
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    console.error('❌ PAYMENT ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
