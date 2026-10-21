const express = require('express');
const db = require('../db');
const {
  SERVICE_SELECT_FIELDS,
  ensureServiceSchema,
  normalizeService
} = require('../utils/serviceModel');

const router = express.Router();

const FALLBACK_SERVICES = [
  {
    id: 1,
    name: 'Chăm sóc da cơ bản',
    price: 450000,
    short_description: 'Làm sạch sâu, cấp ẩm và thư giãn cho làn da mệt mỏi sau nhiều giờ làm việc.',
    detail_description: 'Liệu trình làm sạch, cân bằng ẩm và thư giãn nhẹ nhàng. Phù hợp cho khách muốn chăm da định kỳ với quy trình rõ ràng.',
    category: 'Chăm sóc da',
    duration_min: 60,
    image_url: 'https://static.wixstatic.com/media/11062b_27749fc3fc1f4d1f80f207babc75ae87~mv2.jpeg/v1/fill/w_235%2Ch_235%2Cal_c%2Cq_80%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/Facial.jpeg',
    is_featured: 1
  },
  {
    id: 2,
    name: 'Chăm sóc da chuyên sâu',
    price: 650000,
    short_description: 'Kết hợp công nghệ ánh sáng và tinh chất phục hồi giúp da sáng khỏe, đều màu hơn.',
    detail_description: 'Liệu trình tập trung vào làm sạch sâu, phục hồi hàng rào bảo vệ da và cấp dưỡng chuyên sâu. Kỹ thuật viên sẽ tư vấn theo tình trạng da thực tế trước khi thực hiện.',
    category: 'Chăm sóc da',
    duration_min: 75,
    image_url: 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit%2Cfl_lossy%2Ch_1440%2Cw_720%2Cf_auto%2Cq_1/71709/434479_338603.jpeg',
    is_featured: 1
  },
  {
    id: 3,
    name: 'Massage thư giãn toàn thân',
    price: 380000,
    short_description: 'Thả lỏng cơ bắp, giảm căng thẳng và phục hồi năng lượng với liệu trình êm dịu.',
    detail_description: 'Bài massage toàn thân với lực vừa phải, tập trung cổ vai gáy và lưng để cơ thể nhẹ hơn sau ngày dài.',
    category: 'Chăm sóc body',
    duration_min: 60,
    image_url: 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit%2Cfl_lossy%2Ch_1440%2Cw_720%2Cf_auto%2Cq_1/71709/843734_104872.jpeg',
    is_featured: 1
  }
];

function fallbackServices() {
  return FALLBACK_SERVICES.map((service) =>
    normalizeService({
      benefits_json: JSON.stringify([
        'Quy trình rõ ràng, tư vấn trước khi thực hiện.',
        'Không gian sạch, thoải mái và riêng tư.',
        'Có thể áp dụng ưu đãi hội viên khi thanh toán.'
      ]),
      preparation_notes_json: JSON.stringify([
        'Đến sớm 5-10 phút để xác nhận thông tin.',
        'Thông báo nếu có da nhạy cảm hoặc dị ứng.'
      ]),
      aftercare_notes_json: JSON.stringify([
        'Uống đủ nước sau liệu trình.',
        'Làm theo hướng dẫn chăm sóc của kỹ thuật viên.'
      ]),
      faqs_json: JSON.stringify([
        {
          question: 'Có cần đặt lịch trước không?',
          answer: 'Nên đặt lịch trước để giữ khung giờ phù hợp.'
        }
      ]),
      payment_methods_json: JSON.stringify(['VNPay', 'MoMo', 'QR', 'Tiền mặt']),
      promotion_note: 'Ưu đãi hội viên và voucher được áp dụng ở bước thanh toán.',
      status: 'visible',
      ...service
    })
  );
}

router.get('/', async (_req, res) => {
  try {
    const pool = await db.connect();
    await ensureServiceSchema(pool);

    const rs = await pool.request().query(`
      SELECT ${SERVICE_SELECT_FIELDS}
      FROM services
      WHERE LOWER(IFNULL(status, 'visible')) <> 'hidden'
      ORDER BY id ASC
    `);

    res.json((rs.recordset || []).map(normalizeService));
  } catch (err) {
    console.warn('SERVICES_FALLBACK', err?.message || err);
    res.json(fallbackServices());
  }
});

module.exports = router;
