USE beautycare;

DROP PROCEDURE IF EXISTS add_service_column_if_missing;

DELIMITER //

CREATE PROCEDURE add_service_column_if_missing(IN col_name VARCHAR(64), IN col_ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'services'
      AND COLUMN_NAME = col_name
  ) THEN
    SET @add_column_sql = CONCAT('ALTER TABLE services ADD COLUMN ', col_name, ' ', col_ddl);
    PREPARE add_column_stmt FROM @add_column_sql;
    EXECUTE add_column_stmt;
    DEALLOCATE PREPARE add_column_stmt;
  END IF;
END//

DELIMITER ;

CALL add_service_column_if_missing('short_description', 'TEXT NULL');
CALL add_service_column_if_missing('detail_description', 'LONGTEXT NULL');
CALL add_service_column_if_missing('benefits_json', 'LONGTEXT NULL');
CALL add_service_column_if_missing('preparation_notes_json', 'LONGTEXT NULL');
CALL add_service_column_if_missing('aftercare_notes_json', 'LONGTEXT NULL');
CALL add_service_column_if_missing('faqs_json', 'LONGTEXT NULL');
CALL add_service_column_if_missing('payment_methods_json', 'LONGTEXT NULL');
CALL add_service_column_if_missing('promotion_note', 'TEXT NULL');
CALL add_service_column_if_missing('status', 'VARCHAR(20) NOT NULL DEFAULT ''visible''');
CALL add_service_column_if_missing('related_service_ids_json', 'TEXT NULL');

DROP PROCEDURE add_service_column_if_missing;

UPDATE services
SET
  category = COALESCE(NULLIF(category, ''), 'Chưa phân loại'),
  duration_min = CASE WHEN duration_min IS NULL OR duration_min <= 0 THEN 60 ELSE duration_min END,
  short_description = COALESCE(NULLIF(short_description, ''), description, ''),
  detail_description = COALESCE(NULLIF(detail_description, ''), NULLIF(description, ''), ''),
  benefits_json = COALESCE(NULLIF(benefits_json, ''), '[]'),
  preparation_notes_json = COALESCE(NULLIF(preparation_notes_json, ''), '[]'),
  aftercare_notes_json = COALESCE(NULLIF(aftercare_notes_json, ''), '[]'),
  faqs_json = COALESCE(NULLIF(faqs_json, ''), '[]'),
  payment_methods_json = COALESCE(NULLIF(payment_methods_json, ''), '["VNPay","MoMo","QR","Tiền mặt"]'),
  promotion_note = COALESCE(NULLIF(promotion_note, ''), 'Ưu đãi hội viên và voucher được áp dụng ở bước thanh toán.'),
  status = CASE
    WHEN LOWER(COALESCE(status, 'visible')) IN ('hidden', 'inactive', 'draft', '0', 'false') THEN 'hidden'
    ELSE 'visible'
  END
WHERE id > 0;
