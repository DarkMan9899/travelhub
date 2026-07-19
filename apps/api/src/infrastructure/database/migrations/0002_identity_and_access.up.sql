-- Identity & Access.
-- DATABASE_ARCHITECTURE.md §4.1 + Sprint 5 §4 (Identity and Access Models).
--
-- Amendment vs. DATABASE_ARCHITECTURE.md: the documented `users` /
-- `user_profiles` split keeps "cold" extended data (date_of_birth, etc.)
-- off the hot `users` row. Sprint 5's own User field list contains only
-- hot, every-request fields (email, name, avatar, locale, currency,
-- status, verification) and asks for nothing that belongs in a "cold"
-- table — creating an all-but-empty `user_profiles` now would itself
-- violate the Quality Gate's "no unnecessary tables" check. `user_profiles`
-- is deferred to the sprint that first needs a genuinely cold field.
--
-- Amendment vs. Sprint 5 §4's literal Roles list: VENDOR_OWNER/VENDOR_STAFF
-- are represented as *partner-scoped* roles (`partner_employee_roles`,
-- migration 0003), not rows in this global `roles` table — matching
-- DATABASE_ARCHITECTURE.md §9's documented separation between global RBAC
-- (this file) and partner-scoped RBAC (Ch.15), so a partner-employee
-- token is never sufficient on its own without also matching the specific
-- partner_id being acted on. See docs/SPRINT_5_DATABASE_FOUNDATION.md.

CREATE TABLE IF NOT EXISTS user_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_user_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  -- Lowercased/trimmed form of `email`, used for uniqueness and lookup so
  -- "User@x.com" and "user@x.com" collide as the same account.
  normalized_email VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  -- Soft reference to media.id (migration 0006, created after this file) —
  -- no FK constraint, matching the polymorphic-media pattern used
  -- everywhere else in this schema (DATABASE_ARCHITECTURE.md §13).
  avatar_media_id BIGINT UNSIGNED NULL,
  preferred_language_id BIGINT UNSIGNED NULL,
  preferred_currency_id BIGINT UNSIGNED NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  is_email_verified TINYINT(1) NOT NULL DEFAULT 0,
  email_verified_at DATETIME(3) NULL,
  is_phone_verified TINYINT(1) NOT NULL DEFAULT 0,
  phone_verified_at DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  -- Soft-delete-safe uniqueness (DATABASE_ARCHITECTURE.md §7): collapses
  -- every soft-deleted row's value to NULL, which MySQL's unique index
  -- never treats as a collision — only ACTIVE rows are constrained to a
  -- unique normalized_email, so a deleted account's email can be reused.
  active_normalized_email VARCHAR(255)
    GENERATED ALWAYS AS (IF(deleted_at IS NULL, normalized_email, NULL)) STORED,
  PRIMARY KEY (id),
  CONSTRAINT uq_users_active_normalized_email UNIQUE (active_normalized_email),
  CONSTRAINT fk_users_status_id FOREIGN KEY (status_id) REFERENCES user_statuses (id),
  CONSTRAINT fk_users_preferred_language_id FOREIGN KEY (preferred_language_id) REFERENCES languages (id),
  CONSTRAINT fk_users_preferred_currency_id FOREIGN KEY (preferred_currency_id) REFERENCES currencies (id),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_users_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  KEY idx_users_status_id (status_id),
  KEY idx_users_deleted_at_id (deleted_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Global roles only (DATABASE_ARCHITECTURE.md §9: super_admin, admin,
-- moderator, customer) — partner-scoped roles live in
-- partner_employee_roles (migration 0003), never mixed into this table.
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_roles_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fine-grained, module-qualified capability (e.g. "listing.publish"),
-- attached to roles via permission_role — enforcement code checks a
-- permission key, never a role name directly (BACKEND_ARCHITECTURE.md
-- §14), so the authorization model is extensible without a schema change.
CREATE TABLE IF NOT EXISTS permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_permissions_key UNIQUE (`key`),
  KEY idx_permissions_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_user (
  role_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (role_id, user_id),
  CONSTRAINT fk_role_user_role_id FOREIGN KEY (role_id) REFERENCES roles (id),
  CONSTRAINT fk_role_user_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  KEY idx_role_user_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permission_role (
  permission_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (permission_id, role_id),
  CONSTRAINT fk_permission_role_permission_id FOREIGN KEY (permission_id) REFERENCES permissions (id),
  CONSTRAINT fk_permission_role_role_id FOREIGN KEY (role_id) REFERENCES roles (id),
  KEY idx_permission_role_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only authentication audit trail (DATABASE_ARCHITECTURE.md §4.1).
-- Never updated/deleted, distinct from audit_logs (migration 0011) which
-- covers privileged/state-changing actions platform-wide — this table is
-- specifically the login/security-event stream.
CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  success TINYINT(1) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_login_history_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  KEY idx_login_history_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
