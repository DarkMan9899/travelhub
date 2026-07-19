-- Media Foundation (Sprint 5 §8). DATABASE_ARCHITECTURE.md §4.5: a single
-- polymorphic table serves images/videos/documents for every entity
-- (listings, reviews, users, partners) via mediable_type/mediable_id —
-- no formal FK on that pair, same polymorphic convention as `addresses`
-- and `favorites`. Only metadata + a URL are stored; the file itself
-- lives behind the StorageProvider abstraction
-- (src/core/interfaces/StorageProvider.js) — no production cloud storage
-- is wired up this sprint (Sprint 5 §8, §18).

CREATE TABLE IF NOT EXISTS media_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_media_types_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_upload_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_media_upload_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mediable_type VARCHAR(30) NOT NULL,
  mediable_id BIGINT UNSIGNED NOT NULL,
  media_type_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500) NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  is_cover TINYINT(1) NOT NULL DEFAULT 0,
  upload_status_id BIGINT UNSIGNED NOT NULL,
  moderation_status_id BIGINT UNSIGNED NOT NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  mime_type VARCHAR(100) NULL,
  width_px INT UNSIGNED NULL,
  height_px INT UNSIGNED NULL,
  duration_seconds INT UNSIGNED NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_media_media_type_id FOREIGN KEY (media_type_id) REFERENCES media_types (id),
  CONSTRAINT fk_media_upload_status_id FOREIGN KEY (upload_status_id) REFERENCES media_upload_statuses (id),
  CONSTRAINT fk_media_moderation_status_id FOREIGN KEY (moderation_status_id) REFERENCES moderation_statuses (id),
  CONSTRAINT fk_media_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES users (id),
  CONSTRAINT fk_media_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_media_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_media_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  KEY idx_media_mediable_type_mediable_id (mediable_type, mediable_id),
  KEY idx_media_owner_user_id (owner_user_id),
  KEY idx_media_deleted_at_id (deleted_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  media_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  alt_text VARCHAR(255) NULL,
  caption VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_media_translations_media_id_language_id UNIQUE (media_id, language_id),
  CONSTRAINT fk_media_translations_media_id FOREIGN KEY (media_id) REFERENCES media (id),
  CONSTRAINT fk_media_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
