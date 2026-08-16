-- Notifications Platform foundation (Phase 13). Replaces the empty
-- `apps/api/src/modules/notifications/` scaffold with a real schema.
--
-- Two lookup tables (`notification_categories`, `notification_priorities`)
-- follow this codebase's established bounded-domain convention (see
-- `moderation_statuses`, migration 0003) — `id, code, name` — rather than
-- native SQL ENUM columns, so adding a future category (e.g. PAYMENT,
-- MESSAGING, AI) is a one-row insert, never a schema change.
--
-- `notifications` deliberately stores no rendered title/body text: this
-- codebase's established rule (Phase 4.2) is "i18n owns all labels,
-- backend returns codes only" — the frontend maps `event_type` + `payload`
-- to a localized message via a small registry. `event_id` is nullable
-- (admin-authored announcements have no upstream domain event) and,
-- together with `recipient_user_id`, is protected by a UNIQUE constraint
-- so a republished event can never create a duplicate notification row.
--
-- `resource_type`/`resource_id` is the same polymorphic-reference shape
-- `audit_logs.target_type`/`target_id` already established (migration
-- 0011) — nullable here since an admin announcement has no single
-- resource behind it.

CREATE TABLE IF NOT EXISTS notification_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_notification_categories_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_priorities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_notification_priorities_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_user_id BIGINT UNSIGNED NOT NULL,
  event_id VARCHAR(36) NULL COMMENT 'the publishing DomainEvent''s eventId; NULL for admin-authored announcements',
  event_type VARCHAR(100) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  priority_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NULL COMMENT 'who/what caused this notification; NULL for system-originated',
  resource_type VARCHAR(50) NULL,
  resource_id BIGINT UNSIGNED NULL,
  payload JSON NOT NULL,
  metadata JSON NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME(3) NULL,
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  archived_at DATETIME(3) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_notifications_event_recipient UNIQUE (event_id, recipient_user_id),
  CONSTRAINT fk_notifications_recipient_user_id FOREIGN KEY (recipient_user_id) REFERENCES users (id),
  CONSTRAINT fk_notifications_category_id FOREIGN KEY (category_id) REFERENCES notification_categories (id),
  CONSTRAINT fk_notifications_priority_id FOREIGN KEY (priority_id) REFERENCES notification_priorities (id),
  CONSTRAINT fk_notifications_actor_id FOREIGN KEY (actor_id) REFERENCES users (id),
  KEY idx_notifications_recipient_read_created (recipient_user_id, is_read, created_at),
  KEY idx_notifications_recipient_archived_deleted_created (recipient_user_id, is_archived, deleted_at, created_at),
  KEY idx_notifications_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
  email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_notification_preferences_user_category UNIQUE (user_id, category_id),
  CONSTRAINT fk_notification_preferences_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_notification_preferences_category_id FOREIGN KEY (category_id) REFERENCES notification_categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
