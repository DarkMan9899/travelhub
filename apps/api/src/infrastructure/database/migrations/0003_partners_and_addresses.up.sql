-- Partners ("Vendor Foundation", Sprint 5 §5) + polymorphic address book.
-- DATABASE_ARCHITECTURE.md §4.1. "Partner" is this codebase's existing
-- term for Sprint 5's "Vendor" (every module folder, role, and doc
-- already uses it) — see docs/SPRINT_5_DATABASE_FOUNDATION.md.
--
-- moderation_statuses is a single shared 4-value lookup (PENDING/
-- APPROVED/REJECTED/FLAGGED) reused via two independent FK columns here
-- (verification_status_id, moderation_status_id) and later by listings,
-- media, and reviews (migrations 0005/0006/0009) — one lookup table
-- instead of four near-identical ones, per CLAUDE.md's "never duplicate
-- functionality."

CREATE TABLE IF NOT EXISTS moderation_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_moderation_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partners (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  legal_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT NULL,
  -- Soft references to media.id (migration 0006) — see users.avatar_media_id
  -- above for why these are not formal FKs.
  logo_media_id BIGINT UNSIGNED NULL,
  cover_media_id BIGINT UNSIGNED NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  website VARCHAR(255) NULL,
  social_links JSON NULL COMMENT 'Map of platform -> URL, e.g. {"instagram": "https://..."}',
  verification_status_id BIGINT UNSIGNED NOT NULL,
  moderation_status_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  -- Soft-delete-safe uniqueness — see users.active_normalized_email above.
  active_slug VARCHAR(180) GENERATED ALWAYS AS (IF(deleted_at IS NULL, slug, NULL)) STORED,
  PRIMARY KEY (id),
  CONSTRAINT uq_partners_active_slug UNIQUE (active_slug),
  CONSTRAINT fk_partners_verification_status_id FOREIGN KEY (verification_status_id) REFERENCES moderation_statuses (id),
  CONSTRAINT fk_partners_moderation_status_id FOREIGN KEY (moderation_status_id) REFERENCES moderation_statuses (id),
  CONSTRAINT fk_partners_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES users (id),
  CONSTRAINT fk_partners_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_partners_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_partners_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  KEY idx_partners_owner_user_id (owner_user_id),
  KEY idx_partners_deleted_at_id (deleted_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partner-scoped role vocabulary (Sprint 5 §5 "Vendor members"), assigned
-- per partner_employees row — deliberately richer than
-- DATABASE_ARCHITECTURE.md §9's illustrative 3-role list (owner/manager/
-- staff), which is fine because it is a lookup table: adding/renaming a
-- membership role is a data change, never a schema migration.
CREATE TABLE IF NOT EXISTS partner_employee_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_partner_employee_roles_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One user may belong to many partner organizations (native N:M via this
-- table) — Sprint 5 §5's explicit requirement.
CREATE TABLE IF NOT EXISTS partner_employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  partner_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL COMMENT 'Set when the employee is removed from the partner org',
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  -- Soft-delete-safe uniqueness so a removed-then-reinvited employee can
  -- be re-added without a hard-delete first.
  active_partner_user VARCHAR(41)
    GENERATED ALWAYS AS (IF(deleted_at IS NULL, CONCAT(partner_id, ':', user_id), NULL)) STORED,
  PRIMARY KEY (id),
  CONSTRAINT uq_partner_employees_active_partner_user UNIQUE (active_partner_user),
  CONSTRAINT fk_partner_employees_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_partner_employees_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_partner_employees_role_id FOREIGN KEY (role_id) REFERENCES partner_employee_roles (id),
  CONSTRAINT fk_partner_employees_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_partner_employees_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_partner_employees_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  KEY idx_partner_employees_user_id (user_id),
  KEY idx_partner_employees_partner_id (partner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Polymorphic address book (DATABASE_ARCHITECTURE.md §4.1) — addressable_type
-- is one of 'user' | 'partner' | 'booking'; no formal FK is possible on a
-- polymorphic pair, validated at the Service layer, consistent with every
-- other {x}able_type/{x}able_id pattern in this schema (media, favorites,
-- reviews, notifications, audit_logs).
CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  addressable_type VARCHAR(30) NOT NULL,
  addressable_id BIGINT UNSIGNED NOT NULL,
  line1 VARCHAR(255) NOT NULL,
  line2 VARCHAR(255) NULL,
  city_id BIGINT UNSIGNED NULL,
  postal_code VARCHAR(20) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_addresses_city_id FOREIGN KEY (city_id) REFERENCES cities (id),
  KEY idx_addresses_addressable_type_addressable_id (addressable_type, addressable_id),
  KEY idx_addresses_city_id (city_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
