/* 1. Ngắt kết nối tới database nếu đang dùng */
USE master;
GO

/* 2. Xoá database cũ nếu tồn tại */
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'beautycare')
BEGIN
    ALTER DATABASE beautycare SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE beautycare;
END
GO

/* 3. Tạo lại database mới */
CREATE DATABASE beautycare;
GO

USE beautycare;
GO

/* 4. Tạo bảng users */
CREATE TABLE users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(100),
  email NVARCHAR(100) UNIQUE,
  password NVARCHAR(255),
  role NVARCHAR(10) DEFAULT 'user',
  member NVARCHAR(10) DEFAULT 'silver',
  member_expires_at DATETIME NULL,
  email_verified BIT DEFAULT 0,
  twofa_enabled BIT DEFAULT 0,
  twofa_secret NVARCHAR(200) NULL
);
GO

INSERT INTO users (name, email, password, role, member, email_verified)
VALUES (N'Admin', 'admin@beautycare.com', '$2a$10$xl2u0wMqUimBd24yGkr/T.XujoDRtAgLsN49C2s34vfwNBqyolb5m', 'admin', 'premium', 1);

-- User demo: user@gmail.com / 123456
INSERT INTO users (name, email, password, role, member, email_verified)
VALUES (N'User', 'user@gmail.com', '$2a$10$HMBkACfbRIHbKnmlOvbum.i0DZWwjyIu3Ig9HiYGjusakNu2UK1Bi', 'user', 'silver', 1);

/* 5. Tạo bảng services */
CREATE TABLE services (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(100),
  price INT,
  description NVARCHAR(255) NULL,
  category NVARCHAR(50) NULL,
  duration_min INT NOT NULL DEFAULT 60,
  image_url NVARCHAR(255) NULL,
  is_featured BIT NOT NULL DEFAULT 0
);
GO

/* 6. Tạo bảng transactions */
CREATE TABLE transactions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT,
  original_price INT,
  discount INT,
  final_price INT,
  created_at DATETIME DEFAULT GETDATE()
);
GO

/* 7. Dữ liệu mẫu */
INSERT INTO services (name, price, description, category, duration_min, image_url, is_featured) VALUES
(N'Chăm sóc da cơ bản', 450000, N'Làm sạch sâu, cấp ẩm và thư giãn cho da.', N'Skincare', 60, N'', 1),
(N'Chăm sóc da chuyên sâu', 650000, N'Thiết bị công nghệ hỗ trợ phục hồi và sáng da.', N'Skincare', 75, N'', 1),
(N'Trị mụn chuẩn spa', 550000, N'Lấy nhân mụn, kháng khuẩn và làm dịu da.', N'Skincare', 60, N'', 1),
(N'Massage thư giãn toàn thân', 380000, N'Giảm căng thẳng, giải tỏa mỏi cơ.', N'Body', 60, N'', 1),
(N'Massage đá nóng', 520000, N'Kết hợp đá nóng tăng tuần hoàn máu.', N'Body', 75, N'', 0),
(N'Triệt lông IPL', 800000, N'Triệt lông công nghệ IPL an toàn, ít đau.', N'Beauty', 60, N'', 0),
(N'Gội đầu dưỡng sinh', 260000, N'Thư giãn vùng đầu, cổ, vai gáy.', N'Beauty', 45, N'', 1),
(N'Phun xăm thẩm mỹ (tư vấn)', 150000, N'Tư vấn dáng mày/môi phù hợp khuôn mặt.', N'Beauty', 30, N'', 0),
(N'Chăm sóc móng (Manicure)', 220000, N'Cắt da, tạo dáng, sơn cơ bản.', N'Nails', 45, N'', 0),
(N'Chăm sóc móng (Pedicure)', 260000, N'Tẩy da chết, tạo dáng, dưỡng gót chân.', N'Nails', 60, N'', 0);
GO

CREATE TABLE vouchers (
  id INT IDENTITY PRIMARY KEY,
  code NVARCHAR(50) UNIQUE,
  discount INT,
  expired_at DATE
);

GO

ALTER TABLE transactions
ADD voucher_code NVARCHAR(50);

GO

-- Voucher demo (10%): BEAUTY10
INSERT INTO vouchers (code, discount, expired_at)
VALUES (N'BEAUTY10', 10, DATEADD(day, 30, GETDATE()));

GO

/* 8. Tạo bảng bookings (đặt lịch) */
CREATE TABLE bookings (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME(0) NOT NULL,
  status NVARCHAR(20) DEFAULT 'pending',
  note NVARCHAR(255),
  admin_note NVARCHAR(255),
  created_at DATETIME DEFAULT GETDATE()
);

GO

-- Khóa ngoại (demo)
ALTER TABLE bookings
ADD CONSTRAINT FK_bookings_users FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE bookings
ADD CONSTRAINT FK_bookings_services FOREIGN KEY (service_id) REFERENCES services(id);

GO

CREATE INDEX IX_bookings_date_time ON bookings(booking_date, booking_time);


GO

/* 9. Tạo bảng revoked_tokens (thu hồi token khi logout) */
CREATE TABLE revoked_tokens (
  id INT IDENTITY(1,1) PRIMARY KEY,
  jti NVARCHAR(64) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  revoked_at DATETIME DEFAULT GETDATE(),
  expires_at DATETIME NOT NULL
);
GO

CREATE INDEX IX_revoked_tokens_expires_at ON revoked_tokens(expires_at);
GO

/* 10. Tạo bảng audit_logs (ghi nhận hành động quan trọng) */
CREATE TABLE audit_logs (
  id INT IDENTITY(1,1) PRIMARY KEY,
  actor_user_id INT NULL,
  action NVARCHAR(50) NOT NULL,
  entity NVARCHAR(50) NOT NULL,
  entity_id NVARCHAR(50) NULL,
  meta NVARCHAR(MAX) NULL,
  ip NVARCHAR(45) NULL,
  created_at DATETIME DEFAULT GETDATE()
);
GO

ALTER TABLE audit_logs
ADD CONSTRAINT FK_audit_logs_users FOREIGN KEY (actor_user_id) REFERENCES users(id);
GO

/* 11. Tạo bảng refresh_tokens (refresh token rotation) */
CREATE TABLE refresh_tokens (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash NVARCHAR(64) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT GETDATE(),
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  replaced_by_hash NVARCHAR(64) NULL,
  ip NVARCHAR(45) NULL,
  user_agent NVARCHAR(200) NULL
);
GO

ALTER TABLE refresh_tokens
ADD CONSTRAINT FK_refresh_tokens_users FOREIGN KEY (user_id) REFERENCES users(id);
GO

CREATE INDEX IX_refresh_tokens_user ON refresh_tokens(user_id);
GO

CREATE INDEX IX_refresh_tokens_expires ON refresh_tokens(expires_at);
GO

/* 12. Tạo bảng password_reset_tokens */
CREATE TABLE password_reset_tokens (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash NVARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT GETDATE(),
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL
);
GO

ALTER TABLE password_reset_tokens
ADD CONSTRAINT FK_password_reset_tokens_users FOREIGN KEY (user_id) REFERENCES users(id);
GO

CREATE INDEX IX_password_reset_tokens_expires ON password_reset_tokens(expires_at);
GO

/* 13. Tạo bảng email_verify_tokens */
CREATE TABLE email_verify_tokens (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash NVARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT GETDATE(),
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL
);
GO

ALTER TABLE email_verify_tokens
ADD CONSTRAINT FK_email_verify_tokens_users FOREIGN KEY (user_id) REFERENCES users(id);
GO

CREATE INDEX IX_email_verify_tokens_expires ON email_verify_tokens(expires_at);
GO

/* 14. TMĐT nâng cao: Orders / Payments / Membership plans / Subscriptions */

CREATE TABLE membership_plans (
  id INT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) UNIQUE NOT NULL,
  name NVARCHAR(100) NOT NULL,
  tier NVARCHAR(10) NOT NULL,
  price INT NOT NULL,
  duration_days INT NOT NULL,
  is_active BIT DEFAULT 1
);
GO

INSERT INTO membership_plans (code, name, tier, price, duration_days) VALUES
(N'GOLD_MONTHLY', N'Gói Vàng 1 tháng', N'gold', 99000, 30),
(N'PREMIUM_MONTHLY', N'Gói Premium 1 tháng', N'premium', 199000, 30),
(N'GOLD_YEARLY', N'Gói Vàng 1 năm', N'gold', 990000, 365),
(N'PREMIUM_YEARLY', N'Gói Premium 1 năm', N'premium', 1990000, 365);
GO


/* 14.1 Chính sách giảm giá theo cấp độ (cấu hình được) */
CREATE TABLE discount_policies (
  tier NVARCHAR(10) PRIMARY KEY, -- silver | gold | premium
  rate DECIMAL(5,4) NOT NULL      -- 0.0500 = 5%
);
GO

CREATE TABLE discount_settings (
  [key] NVARCHAR(50) PRIMARY KEY,
  [value] NVARCHAR(50) NOT NULL
);
GO

-- Default policies (can be updated by admin)
IF NOT EXISTS (SELECT 1 FROM discount_policies WHERE tier='silver')
  INSERT INTO discount_policies (tier, rate) VALUES (N'silver', 0.0500);
IF NOT EXISTS (SELECT 1 FROM discount_policies WHERE tier='gold')
  INSERT INTO discount_policies (tier, rate) VALUES (N'gold', 0.1000);
IF NOT EXISTS (SELECT 1 FROM discount_policies WHERE tier='premium')
  INSERT INTO discount_policies (tier, rate) VALUES (N'premium', 0.2000);
GO

-- Max stacked discount cap (member + voucher). Default 95%
IF NOT EXISTS (SELECT 1 FROM discount_settings WHERE [key]='max_total_rate')
  INSERT INTO discount_settings ([key],[value]) VALUES (N'max_total_rate', N'0.95');
GO

CREATE TABLE subscriptions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  status NVARCHAR(20) DEFAULT 'pending',
  start_at DATETIME NULL,
  end_at DATETIME NULL,
  auto_renew BIT DEFAULT 0,
  provider NVARCHAR(20) NULL,
  provider_ref NVARCHAR(100) NULL,
  created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME NULL
);
GO

ALTER TABLE subscriptions
ADD CONSTRAINT FK_subscriptions_users FOREIGN KEY (user_id) REFERENCES users(id);
GO

ALTER TABLE subscriptions
ADD CONSTRAINT FK_subscriptions_plans FOREIGN KEY (plan_id) REFERENCES membership_plans(id);
GO

CREATE INDEX IX_subscriptions_user ON subscriptions(user_id);
GO

CREATE TABLE orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  booking_id INT NULL,
  original_price INT NOT NULL,
  discount INT NOT NULL,
  final_price INT NOT NULL,
  voucher_code NVARCHAR(50) NULL,
  status NVARCHAR(20) DEFAULT 'pending',
  created_at DATETIME DEFAULT GETDATE(),
  paid_at DATETIME NULL
);
GO

ALTER TABLE orders
ADD CONSTRAINT FK_orders_users FOREIGN KEY (user_id) REFERENCES users(id);
GO

ALTER TABLE orders
ADD CONSTRAINT FK_orders_services FOREIGN KEY (service_id) REFERENCES services(id);
GO

ALTER TABLE orders
ADD CONSTRAINT FK_orders_bookings FOREIGN KEY (booking_id) REFERENCES bookings(id);
GO

CREATE INDEX IX_orders_user ON orders(user_id);
GO

CREATE TABLE payments (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  provider NVARCHAR(20) NOT NULL,
  purpose NVARCHAR(20) NOT NULL, -- checkout | subscription
  order_id INT NULL,
  subscription_id INT NULL,
  amount INT NOT NULL,
  currency NVARCHAR(10) DEFAULT 'VND',
  status NVARCHAR(20) DEFAULT 'created',
  provider_ref NVARCHAR(100) UNIQUE NOT NULL,
  created_at DATETIME DEFAULT GETDATE(),
  paid_at DATETIME NULL
);
GO

ALTER TABLE payments
ADD CONSTRAINT FK_payments_users FOREIGN KEY (user_id) REFERENCES users(id);
GO

ALTER TABLE payments
ADD CONSTRAINT FK_payments_orders FOREIGN KEY (order_id) REFERENCES orders(id);
GO

ALTER TABLE payments
ADD CONSTRAINT FK_payments_subscriptions FOREIGN KEY (subscription_id) REFERENCES subscriptions(id);
GO

CREATE INDEX IX_payments_user ON payments(user_id);
GO

CREATE TABLE payment_events (
  id INT IDENTITY(1,1) PRIMARY KEY,
  payment_id INT NULL,
  provider NVARCHAR(20) NOT NULL,
  event_type NVARCHAR(50) NOT NULL,
  payload NVARCHAR(MAX) NULL,
  received_at DATETIME DEFAULT GETDATE()
);
GO

ALTER TABLE payment_events
ADD CONSTRAINT FK_payment_events_payments FOREIGN KEY (payment_id) REFERENCES payments(id);
GO

CREATE INDEX IX_payment_events_received ON payment_events(received_at);
GO

-- 1) Thêm cột status nếu chưa có
IF COL_LENGTH('dbo.bookings', 'status') IS NULL
BEGIN
  ALTER TABLE dbo.bookings
  ADD status NVARCHAR(20) NOT NULL
      CONSTRAINT DF_bookings_status DEFAULT 'pending';
END

-- 2) Thêm admin_note nếu chưa có
IF COL_LENGTH('dbo.bookings', 'admin_note') IS NULL
BEGIN
  ALTER TABLE dbo.bookings
  ADD admin_note NVARCHAR(255) NULL;
END

-- 3) Thêm created_at nếu chưa có
IF COL_LENGTH('dbo.bookings', 'created_at') IS NULL
BEGIN
  ALTER TABLE dbo.bookings
  ADD created_at DATETIME NOT NULL
      CONSTRAINT DF_bookings_created_at DEFAULT GETDATE();
END

-- 4) Fill dữ liệu cũ
UPDATE dbo.bookings
SET status = 'pending'
WHERE status IS NULL;
