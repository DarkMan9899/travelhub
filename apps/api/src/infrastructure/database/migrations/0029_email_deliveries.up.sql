-- P0.3 (Master Roadmap): email delivery had no persisted, queryable
-- outcome anywhere — `NotificationDeliveryService#deliverViaChannel`
-- returned a result only the BullMQ worker's own return value ever saw,
-- with nothing recorded for later diagnosis ("did this email actually
-- send?" was unanswerable after the fact). One append-only row per
-- attempt (never updated, matching `inventory_ledger`'s and
-- `payment_transactions`'s own append-only precedent) — a redelivered
-- notification or a retried job produces a new row, not a mutated one,
-- so the full attempt history for a notification is always intact.

CREATE TABLE IF NOT EXISTS email_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  notification_id BIGINT UNSIGNED NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  provider VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL COMMENT 'SENT | FAILED',
  error_message VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_email_deliveries_notification_id FOREIGN KEY (notification_id) REFERENCES notifications (id),
  KEY idx_email_deliveries_notification_id (notification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
