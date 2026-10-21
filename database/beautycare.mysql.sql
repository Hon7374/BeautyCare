DROP DATABASE IF EXISTS beautycare;
CREATE DATABASE beautycare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE beautycare;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  role VARCHAR(10) NOT NULL DEFAULT 'user',
  member VARCHAR(10) NOT NULL DEFAULT 'silver',
  member_expires_at DATETIME NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  twofa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  twofa_secret VARCHAR(200) NULL
) ENGINE=InnoDB;

INSERT INTO users (name, phone, email, password, role, member, email_verified)
VALUES
  ('Quản trị viên BeautyCare', '0900000000', 'khucmai51@gmail.com', '$2a$10$xl2u0wMqUimBd24yGkr/T.XujoDRtAgLsN49C2s34vfwNBqyolb5m', 'admin', 'premium', 1),
  ('Nguyễn Minh Anh', '0911111111', 'minh.anh@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'silver', 1),
  ('Trần Gia Hân', '0911111112', 'gia.han@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'silver', 1),
  ('Lê Khánh Linh', '0911111113', 'khanh.linh@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'gold', 1),
  ('Phạm Ngọc Mai', '0911111114', 'ngoc.mai@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'silver', 1),
  ('Hoàng Thu Trang', '0911111115', 'thu.trang@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'premium', 1),
  ('Võ Đức Long', '0911111116', 'duc.long@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'gold', 1),
  ('Bùi Nhật Nam', '0911111117', 'nhat.nam@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'silver', 1),
  ('Đặng Hà My', '0911111118', 'ha.my@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'silver', 1),
  ('Nguyễn Quỳnh Anh', '0911111119', 'quynh.anh@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'gold', 1),
  ('Trương Bảo Châu', '0911111120', 'bao.chau@beautycare.vn', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'premium', 1);

CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  price INT,
  description VARCHAR(255) NULL,
  category VARCHAR(50) NULL,
  duration_min INT NOT NULL DEFAULT 60,
  image_url VARCHAR(255) NULL,
  short_description TEXT NULL,
  detail_description LONGTEXT NULL,
  benefits_json LONGTEXT NULL,
  preparation_notes_json LONGTEXT NULL,
  aftercare_notes_json LONGTEXT NULL,
  faqs_json LONGTEXT NULL,
  payment_methods_json LONGTEXT NULL,
  promotion_note TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'visible',
  related_service_ids_json TEXT NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO services (name, price, description, category, duration_min, image_url, is_featured)
VALUES
  ('Chăm sóc da cơ bản', 450000, 'Làm sạch sâu, cấp ẩm và thư giãn cho làn da mệt mỏi sau nhiều giờ làm việc.', 'Chăm sóc da', 60, 'https://static.wixstatic.com/media/11062b_27749fc3fc1f4d1f80f207babc75ae87~mv2.jpeg/v1/fill/w_235%2Ch_235%2Cal_c%2Cq_80%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/Facial.jpeg', 1),
  ('Chăm sóc da chuyên sâu', 650000, 'Kết hợp công nghệ ánh sáng và tinh chất phục hồi giúp da sáng khỏe, đều màu hơn.', 'Chăm sóc da', 75, 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit%2Cfl_lossy%2Ch_1440%2Cw_720%2Cf_auto%2Cq_1/71709/434479_338603.jpeg', 1),
  ('Trị mụn chuẩn spa', 550000, 'Lấy nhân mụn đúng chuẩn, kháng khuẩn và làm dịu da để hạn chế thâm sau liệu trình.', 'Chăm sóc da', 60, 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit%2Cfl_lossy%2Ch_1440%2Cw_720%2Cf_auto%2Cq_1/71709/307188_957534.jpeg', 1),
  ('Massage thư giãn toàn thân', 380000, 'Thả lỏng cơ bắp, giảm căng thẳng và phục hồi năng lượng với liệu trình êm dịu.', 'Chăm sóc body', 60, 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit%2Cfl_lossy%2Ch_1440%2Cw_720%2Cf_auto%2Cq_1/71709/843734_104872.jpeg', 1),
  ('Massage đá nóng', 520000, 'Liệu pháp đá nóng hỗ trợ lưu thông khí huyết, giúp cơ thể thư thái và ngủ ngon hơn.', 'Chăm sóc body', 75, 'https://static.wixstatic.com/media/11062b_5925d424ab9d4dd881aee7162dc1cf7c~mv2.jpg/v1/fill/w_460%2Ch_660%2Cal_c%2Cq_80%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/Hot%20stone%20back%20massage.jpg', 0),
  ('Triệt lông IPL', 800000, 'Ứng dụng công nghệ IPL an toàn, hạn chế đau rát và phù hợp nhiều vùng da khác nhau.', 'Làm đẹp', 60, 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit%2Cfl_lossy%2Ch_1440%2Cw_720%2Cf_auto%2Cq_1/71709/941172_312033.jpeg', 0),
  ('Gội đầu dưỡng sinh', 260000, 'Thư giãn vùng đầu, cổ, vai gáy với động tác day ấn nhẹ và tinh dầu thảo mộc dễ chịu.', 'Làm đẹp', 45, '/assets/services/goi-dau-duong-sinh.jpg', 1),
  ('Phun xăm thẩm mỹ tư vấn', 150000, 'Tư vấn dáng mày, môi hoặc mí phù hợp khuôn mặt trước khi thực hiện liệu trình chính.', 'Làm đẹp', 30, 'https://static.wixstatic.com/media/b6a9d0_47671ae6ef0c4f34b2eb52f426761cdc~mv2.jpg/v1/fill/w_235%2Ch_235%2Cal_c%2Cq_80%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/ls%20lips%202.jpg', 0),
  ('Chăm sóc móng tay', 220000, 'Cắt da, tạo dáng và sơn dưỡng giúp bàn tay gọn gàng, sáng khỏe và tinh tế hơn.', 'Chăm sóc móng', 45, 'https://static.wixstatic.com/media/b6a9d0_e42a64118ee744b3ac07f189a2951930~mv2.jpg/v1/fill/w_234%2Ch_226%2Cal_c%2Cq_80%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/ls%20nails%2014.jpg', 0),
  ('Chăm sóc móng chân', 260000, 'Tẩy da chết, dưỡng gót chân và tạo dáng móng giúp đôi chân mềm mại, sạch đẹp.', 'Chăm sóc móng', 60, '/assets/services/cham-soc-mong-chan.svg', 0);

UPDATE services
SET
  short_description = description,
  detail_description = CONCAT(description, '\n\nKỹ thuật viên BeautyCare sẽ tư vấn theo tình trạng thực tế, chuẩn bị dụng cụ sạch và hướng dẫn chăm sóc sau liệu trình.'),
  benefits_json = '["Quy trình rõ ràng, tư vấn trước khi thực hiện.","Không gian sạch, riêng tư và chuẩn bị theo từng lịch hẹn.","Có thể áp dụng ưu đãi hội viên và voucher ở bước thanh toán."]',
  preparation_notes_json = '["Đến sớm 5-10 phút để xác nhận lịch hẹn.","Thông báo trước nếu có da nhạy cảm, dị ứng hoặc đang điều trị.","Mang trang phục thoải mái để quá trình chăm sóc thuận tiện hơn."]',
  aftercare_notes_json = '["Uống đủ nước và nghỉ ngơi hợp lý sau dịch vụ.","Tránh tác động mạnh lên vùng vừa thực hiện trong 24 giờ đầu.","Liên hệ BeautyCare nếu cần tư vấn thêm sau liệu trình."]',
  faqs_json = '[{"question":"Có cần đặt lịch trước không?","answer":"Nên đặt lịch trước để giữ khung giờ phù hợp và được phục vụ đúng giờ."},{"question":"Thanh toán bằng cách nào?","answer":"BeautyCare hỗ trợ VNPay, MoMo, QR và tiền mặt tùy thời điểm."},{"question":"Ưu đãi hội viên áp dụng ở đâu?","answer":"Ưu đãi được tính ở bước thanh toán khi khách hàng đặt lịch hoặc thanh toán dịch vụ."}]',
  payment_methods_json = '["VNPay","MoMo","QR","Tiền mặt"]',
  promotion_note = 'Ưu đãi hội viên và voucher được áp dụng ở bước thanh toán.',
  status = 'visible'
WHERE short_description IS NULL;

CREATE TABLE vouchers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount INT NOT NULL,
  expired_at DATE NULL
) ENGINE=InnoDB;

INSERT INTO vouchers (code, discount, expired_at)
VALUES ('BEAUTY10', 10, DATE_ADD(CURDATE(), INTERVAL 30 DAY));

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  note VARCHAR(255) NULL,
  admin_note VARCHAR(255) NULL,
  amount INT NULL,
  discount_amount INT NULL,
  total_amount INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_users FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_services FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB;

CREATE INDEX ix_bookings_date_time ON bookings (booking_date, booking_time);

CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  original_price INT NOT NULL,
  discount INT NOT NULL,
  final_price INT NOT NULL,
  voucher_code VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_users FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE revoked_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  jti VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  CONSTRAINT fk_revoked_tokens_users FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE INDEX ix_revoked_tokens_expires_at ON revoked_tokens (expires_at);

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NULL,
  meta LONGTEXT NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_users FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  replaced_by_hash VARCHAR(64) NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(200) NULL,
  CONSTRAINT fk_refresh_tokens_users FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX ix_refresh_tokens_expires ON refresh_tokens (expires_at);

CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  CONSTRAINT fk_password_reset_tokens_users FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE INDEX ix_password_reset_tokens_expires ON password_reset_tokens (expires_at);

CREATE TABLE email_verify_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  CONSTRAINT fk_email_verify_tokens_users FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE INDEX ix_email_verify_tokens_expires ON email_verify_tokens (expires_at);

CREATE TABLE membership_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  tier VARCHAR(10) NOT NULL,
  price INT NOT NULL,
  duration_days INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

INSERT INTO membership_plans (code, name, tier, price, duration_days)
VALUES
  ('GOLD_MONTHLY', 'Gói Vàng 1 tháng', 'gold', 99000, 30),
  ('PREMIUM_MONTHLY', 'Gói Premium 1 tháng', 'premium', 199000, 30),
  ('GOLD_YEARLY', 'Gói Vàng 1 năm', 'gold', 990000, 365),
  ('PREMIUM_YEARLY', 'Gói Premium 1 năm', 'premium', 1990000, 365);

CREATE TABLE discount_policies (
  tier VARCHAR(10) PRIMARY KEY,
  rate DECIMAL(5,4) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE discount_settings (
  `key` VARCHAR(50) PRIMARY KEY,
  `value` VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

INSERT INTO discount_policies (tier, rate)
VALUES
  ('silver', 0.0500),
  ('gold', 0.1000),
  ('premium', 0.2000)
ON DUPLICATE KEY UPDATE rate = VALUES(rate);

INSERT INTO discount_settings (`key`, `value`)
VALUES ('max_total_rate', '0.95')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

CREATE TABLE subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  start_at DATETIME NULL,
  end_at DATETIME NULL,
  auto_renew TINYINT(1) NOT NULL DEFAULT 0,
  provider VARCHAR(20) NULL,
  provider_ref VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  CONSTRAINT fk_subscriptions_users FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_subscriptions_plans FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
) ENGINE=InnoDB;

CREATE INDEX ix_subscriptions_user ON subscriptions (user_id);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  booking_id INT NULL,
  original_price INT NOT NULL,
  discount INT NOT NULL,
  final_price INT NOT NULL,
  voucher_code VARCHAR(50) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  CONSTRAINT fk_orders_users FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_orders_services FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_orders_bookings FOREIGN KEY (booking_id) REFERENCES bookings(id)
) ENGINE=InnoDB;

CREATE INDEX ix_orders_user ON orders (user_id);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  provider VARCHAR(20) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  order_id INT NULL,
  booking_id INT NULL,
  subscription_id INT NULL,
  amount INT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'VND',
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  provider_ref VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  CONSTRAINT fk_payments_users FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_payments_orders FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_payments_bookings FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_payments_subscriptions FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
) ENGINE=InnoDB;

CREATE INDEX ix_payments_user ON payments (user_id);

CREATE TABLE payment_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NULL,
  provider VARCHAR(20) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload LONGTEXT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_events_payments FOREIGN KEY (payment_id) REFERENCES payments(id)
) ENGINE=InnoDB;

CREATE INDEX ix_payment_events_received ON payment_events (received_at);

-- Seed additional admin-facing demo data

INSERT INTO vouchers (code, discount, expired_at)
VALUES
  ('SPAWEEKEND', 15, DATE_ADD(CURDATE(), INTERVAL 45 DAY)),
  ('NEWCLIENT20', 20, DATE_ADD(CURDATE(), INTERVAL 25 DAY)),
  ('MEMBER25', 25, DATE_ADD(CURDATE(), INTERVAL 90 DAY)),
  ('FLASH5', 5, DATE_ADD(CURDATE(), INTERVAL 7 DAY)),
  ('OLDGLOW', 12, DATE_SUB(CURDATE(), INTERVAL 10 DAY));

INSERT INTO bookings (
  user_id, service_id, booking_date, booking_time, status, note, admin_note,
  amount, discount_amount, total_amount, created_at
)
VALUES
  (2, 1, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '09:00:00', 'pending', 'Da nhay cam, uu tien san pham diu nhe.', NULL, 450000, 22500, 427500, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (3, 2, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '10:30:00', 'confirmed', 'Muon duoc tu van them ve routine cham soc.', 'Da giu phong va ky thuat vien.', 650000, 32500, 617500, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (4, 4, DATE_SUB(CURDATE(), INTERVAL 5 DAY), '14:00:00', 'completed', 'Can phong yen tinh de thu gian.', 'Khach da su dung dich vu tot.', 380000, 38000, 342000, DATE_SUB(NOW(), INTERVAL 7 DAY)),
  (5, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '16:00:00', 'cancelled', 'Muon lan kim lay nhan mun nhe.', 'Khach doi lich sang tuan sau.', 550000, 27500, 522500, DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (6, 6, DATE_SUB(CURDATE(), INTERVAL 10 DAY), '11:00:00', 'completed', 'Triet long vung tay.', 'Da hoan tat va da huong dan cham soc sau lieu trinh.', 800000, 160000, 640000, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (7, 7, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '15:30:00', 'confirmed', 'Can xep ky thuat vien massage dau co vai gay.', 'Da xac nhan lich hen.', 260000, 26000, 234000, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (8, 9, DATE_ADD(CURDATE(), INTERVAL 6 DAY), '13:30:00', 'pending', 'Muon son mau nude nhe.', NULL, 220000, 11000, 209000, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (9, 10, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00', 'completed', 'Can cham soc got chan ky hon.', 'Da hoan tat va ghi nhan phan hoi tot.', 260000, 13000, 247000, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (10, 5, DATE_ADD(CURDATE(), INTERVAL 8 DAY), '18:00:00', 'confirmed', 'Can xep phong rieng va khong gian yen tinh.', 'Da khoa slot cuoi ngay.', 520000, 52000, 468000, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (11, 8, DATE_ADD(CURDATE(), INTERVAL 4 DAY), '09:30:00', 'pending', 'Chi can tu van dang long may va mau moi.', NULL, 150000, 30000, 120000, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (2, 4, DATE_SUB(CURDATE(), INTERVAL 15 DAY), '10:00:00', 'completed', 'Massage thu gian sau gio lam.', 'Khach quay lai lan hai.', 380000, 19000, 361000, DATE_SUB(NOW(), INTERVAL 16 DAY)),
  (3, 1, DATE_SUB(CURDATE(), INTERVAL 20 DAY), '08:30:00', 'cancelled', 'Muon doi lich sang cuoi thang.', 'Khach huy truoc gio hen.', 450000, 22500, 427500, DATE_SUB(NOW(), INTERVAL 21 DAY));

INSERT INTO subscriptions (
  user_id, plan_id, status, start_at, end_at, auto_renew, provider, provider_ref, created_at, updated_at
)
VALUES
  (6, 2, 'active', DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_ADD(NOW(), INTERVAL 18 DAY), 1, 'momo', 'SUB-BC-0001', DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (4, 1, 'active', DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_ADD(NOW(), INTERVAL 5 DAY), 0, 'vnpay', 'SUB-BC-0002', DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (8, 3, 'expired', DATE_SUB(NOW(), INTERVAL 400 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY), 0, 'vnpay', 'SUB-BC-0003', DATE_SUB(NOW(), INTERVAL 400 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY)),
  (10, 4, 'active', DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_ADD(NOW(), INTERVAL 320 DAY), 1, 'stripe', 'SUB-BC-0004', DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (5, 2, 'pending', NULL, NULL, 0, 'momo', 'SUB-BC-0005', DATE_SUB(NOW(), INTERVAL 2 DAY), NULL),
  (11, 2, 'cancelled', DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY), 0, 'momo', 'SUB-BC-0006', DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (3, 1, 'pending', NULL, NULL, 0, 'vnpay', 'SUB-BC-0007', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL);

UPDATE users
SET member = 'gold',
    member_expires_at = DATE_ADD(NOW(), INTERVAL 5 DAY)
WHERE id = 4;

UPDATE users
SET member = 'premium',
    member_expires_at = DATE_ADD(NOW(), INTERVAL 18 DAY)
WHERE id = 6;

UPDATE users
SET member = 'premium',
    member_expires_at = DATE_ADD(NOW(), INTERVAL 320 DAY)
WHERE id = 10;

UPDATE users
SET member = 'silver',
    member_expires_at = NULL
WHERE id IN (8, 11);

INSERT INTO orders (
  user_id, service_id, booking_id, original_price, discount, final_price, voucher_code, status, created_at, paid_at
)
VALUES
  (4, 4, 3, 380000, 38000, 342000, NULL, 'paid', DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
  (6, 6, 5, 800000, 160000, 640000, NULL, 'paid', DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY)),
  (7, 7, 6, 260000, 39000, 221000, 'BEAUTY10', 'paid', DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (9, 10, 8, 260000, 13000, 247000, NULL, 'paid', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (10, 5, 9, 520000, 78000, 442000, 'FLASH5', 'pending', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL),
  (2, 4, 11, 380000, 57000, 323000, 'SPAWEEKEND', 'paid', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY)),
  (3, 2, NULL, 650000, 97500, 552500, 'NEWCLIENT20', 'paid', DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 19 DAY)),
  (11, 9, NULL, 220000, 44000, 176000, 'MEMBER25', 'pending', DATE_SUB(NOW(), INTERVAL 3 DAY), NULL);

INSERT INTO payments (
  user_id, provider, purpose, order_id, booking_id, subscription_id,
  amount, currency, status, provider_ref, created_at, paid_at
)
VALUES
  (4, 'vnpay', 'checkout', 1, 3, NULL, 342000, 'VND', 'paid', 'PAY-ORDER-0001', DATE_SUB(NOW(), INTERVAL 8 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY)),
  (6, 'momo', 'checkout', 2, 5, NULL, 640000, 'VND', 'paid', 'PAY-ORDER-0002', DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 11 DAY)),
  (7, 'qr', 'checkout', 3, 6, NULL, 221000, 'VND', 'paid', 'PAY-ORDER-0003', DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (9, 'cash', 'checkout', 4, 8, NULL, 247000, 'VND', 'paid', 'PAY-ORDER-0004', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (10, 'vnpay', 'checkout', 5, 9, NULL, 442000, 'VND', 'pending', 'PAY-ORDER-0005', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL),
  (2, 'momo', 'checkout', 6, 11, NULL, 323000, 'VND', 'paid', 'PAY-ORDER-0006', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_SUB(NOW(), INTERVAL 14 DAY)),
  (3, 'stripe', 'checkout', 7, NULL, NULL, 552500, 'VND', 'paid', 'PAY-ORDER-0007', DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 19 DAY)),
  (11, 'qr', 'checkout', 8, NULL, NULL, 176000, 'VND', 'created', 'PAY-ORDER-0008', DATE_SUB(NOW(), INTERVAL 3 DAY), NULL),
  (6, 'momo', 'subscription', NULL, NULL, 1, 199000, 'VND', 'paid', 'PAY-SUB-0001', DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (4, 'vnpay', 'subscription', NULL, NULL, 2, 99000, 'VND', 'paid', 'PAY-SUB-0002', DATE_SUB(NOW(), INTERVAL 25 DAY), DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (8, 'vnpay', 'subscription', NULL, NULL, 3, 990000, 'VND', 'paid', 'PAY-SUB-0003', DATE_SUB(NOW(), INTERVAL 400 DAY), DATE_SUB(NOW(), INTERVAL 400 DAY)),
  (10, 'stripe', 'subscription', NULL, NULL, 4, 1990000, 'VND', 'paid', 'PAY-SUB-0004', DATE_SUB(NOW(), INTERVAL 45 DAY), DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (5, 'momo', 'subscription', NULL, NULL, 5, 199000, 'VND', 'pending', 'PAY-SUB-0005', DATE_SUB(NOW(), INTERVAL 2 DAY), NULL),
  (11, 'momo', 'subscription', NULL, NULL, 6, 199000, 'VND', 'paid', 'PAY-SUB-0006', DATE_SUB(NOW(), INTERVAL 70 DAY), DATE_SUB(NOW(), INTERVAL 69 DAY)),
  (3, 'vnpay', 'subscription', NULL, NULL, 7, 99000, 'VND', 'created', 'PAY-SUB-0007', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL);

INSERT INTO transactions (user_id, original_price, discount, final_price, voucher_code, created_at)
VALUES
  (4, 380000, 38000, 342000, NULL, DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (6, 800000, 160000, 640000, NULL, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (7, 260000, 39000, 221000, 'BEAUTY10', DATE_SUB(NOW(), INTERVAL 4 DAY)),
  (9, 260000, 13000, 247000, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (10, 520000, 78000, 442000, 'FLASH5', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (2, 380000, 57000, 323000, 'SPAWEEKEND', DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (3, 650000, 97500, 552500, 'NEWCLIENT20', DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (11, 220000, 44000, 176000, 'MEMBER25', DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (6, 199000, 0, 199000, NULL, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (10, 1990000, 0, 1990000, NULL, DATE_SUB(NOW(), INTERVAL 45 DAY));

INSERT INTO payment_events (payment_id, provider, event_type, payload, received_at)
VALUES
  (1, 'vnpay', 'payment_created', '{"status":"created","ref":"PAY-ORDER-0001"}', DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (1, 'vnpay', 'payment_paid', '{"status":"paid","ref":"PAY-ORDER-0001"}', DATE_SUB(NOW(), INTERVAL 7 DAY)),
  (2, 'momo', 'payment_paid', '{"status":"paid","ref":"PAY-ORDER-0002"}', DATE_SUB(NOW(), INTERVAL 11 DAY)),
  (5, 'vnpay', 'payment_pending', '{"status":"pending","ref":"PAY-ORDER-0005"}', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (9, 'momo', 'subscription_paid', '{"status":"paid","ref":"PAY-SUB-0001"}', DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (10, 'vnpay', 'subscription_paid', '{"status":"paid","ref":"PAY-SUB-0002"}', DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (12, 'stripe', 'subscription_paid', '{"status":"paid","ref":"PAY-SUB-0004"}', DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (15, 'vnpay', 'subscription_created', '{"status":"created","ref":"PAY-SUB-0007"}', DATE_SUB(NOW(), INTERVAL 1 DAY));

INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, meta, ip, created_at)
VALUES
  (1, 'create', 'voucher', 'SPAWEEKEND', '{"discount":15}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 30 DAY)),
  (1, 'create', 'voucher', 'NEWCLIENT20', '{"discount":20}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 24 DAY)),
  (1, 'update', 'booking', '2', '{"status":"confirmed"}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (1, 'update', 'booking', '4', '{"status":"cancelled"}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (1, 'update', 'subscription', '1', '{"status":"active","auto_renew":true}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (1, 'update', 'subscription', '4', '{"status":"active","extend_days":30}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (1, 'update', 'discount_policy', 'global', '{"silver":0.05,"gold":0.10,"premium":0.20}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (1, 'create', 'payment', 'PAY-ORDER-0001', '{"provider":"vnpay","purpose":"checkout"}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (1, 'create', 'payment', 'PAY-SUB-0004', '{"provider":"stripe","purpose":"subscription"}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 45 DAY)),
  (1, 'update', 'user', '10', '{"member":"premium"}', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 45 DAY));
