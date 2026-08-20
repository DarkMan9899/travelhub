CREATE TABLE IF NOT EXISTS review_report_reasons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_review_report_reasons_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  reporter_user_id BIGINT UNSIGNED NOT NULL,
  reason_id BIGINT UNSIGNED NOT NULL,
  details VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_review_reports_review_reporter UNIQUE (review_id, reporter_user_id),
  CONSTRAINT fk_review_reports_review_id FOREIGN KEY (review_id) REFERENCES reviews (id),
  CONSTRAINT fk_review_reports_reporter_user_id FOREIGN KEY (reporter_user_id) REFERENCES users (id),
  CONSTRAINT fk_review_reports_reason_id FOREIGN KEY (reason_id) REFERENCES review_report_reasons (id),
  CONSTRAINT fk_review_reports_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (id),
  KEY idx_review_reports_review_id (review_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
