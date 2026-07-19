-- Taxonomy master data (Sprint 5 §6): hierarchical categories, reusable
-- amenities, reusable tags. Pivot tables linking these to `listings` live
-- in migration 0005, since `listings` does not exist yet.
-- DATABASE_ARCHITECTURE.md §4.3 (listing_categories, listing_amenities);
-- `tags` is new/additive — Sprint 5 asks for it, the documented schema
-- doesn't have it, so it follows the exact same shape as
-- listing_amenities (DATABASE_ARCHITECTURE.md §16 governance: an
-- additive table following an established pattern).

CREATE TABLE IF NOT EXISTS listing_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  icon_media_id BIGINT UNSIGNED NULL COMMENT 'Soft reference to media.id (migration 0006)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_listing_categories_slug UNIQUE (slug),
  CONSTRAINT fk_listing_categories_parent_id FOREIGN KEY (parent_id) REFERENCES listing_categories (id),
  KEY idx_listing_categories_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_category_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_category_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_listing_category_translations_category_id_language_id UNIQUE (listing_category_id, language_id),
  CONSTRAINT fk_listing_category_translations_category_id FOREIGN KEY (listing_category_id) REFERENCES listing_categories (id),
  CONSTRAINT fk_listing_category_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_amenities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  icon_media_id BIGINT UNSIGNED NULL COMMENT 'Soft reference to media.id (migration 0006)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_amenity_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_amenity_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_listing_amenity_translations_amenity_id_language_id UNIQUE (listing_amenity_id, language_id),
  CONSTRAINT fk_listing_amenity_translations_amenity_id FOREIGN KEY (listing_amenity_id) REFERENCES listing_amenities (id),
  CONSTRAINT fk_listing_amenity_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_tags_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tag_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tag_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_tag_translations_tag_id_language_id UNIQUE (tag_id, language_id),
  CONSTRAINT fk_tag_translations_tag_id FOREIGN KEY (tag_id) REFERENCES tags (id),
  CONSTRAINT fk_tag_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
