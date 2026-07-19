-- Audit and Activity Logging Foundation (Sprint 5 §14).
-- DATABASE_ARCHITECTURE.md §8/§21-22: `audit_logs` is the single,
-- polymorphic, insert-only ledger for privileged/state-changing actions
-- (authentication events, role changes, partner verification, listing
-- moderation, booking status changes, review moderation, advertisement
-- approval/payment-status changes, admin configuration changes) — never
-- updated or deleted after insert, and the ONLY sanctioned writer is the
-- shared AuditLogger service (src/core/domain/auditLogger.js). Passwords/
-- tokens/secrets are never placed in before_snapshot/after_snapshot — that
-- is a call-site discipline the AuditLogger's callers must uphold, not
-- something the schema can enforce.
--
-- `activity_logs` is a separate, lighter, non-blocking/queued stream for
-- general engagement activity (Ch.22) — not compliance evidence, distinct
-- from `login_history` (migration 0002, specifically the auth/security
-- event stream) and from `audit_logs` (this file, compliance-grade).

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED NULL COMMENT 'NULL for system/scheduled-job actions',
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  before_snapshot JSON NULL,
  after_snapshot JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  request_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_audit_logs_actor_id FOREIGN KEY (actor_id) REFERENCES users (id),
  -- Entity change-history lookup from any admin screen (DATABASE_ARCHITECTURE.md §6.2).
  KEY idx_audit_logs_target_type_target_id_created_at (target_type, target_id, created_at),
  KEY idx_audit_logs_actor_id (actor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_activity_logs_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  KEY idx_activity_logs_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
