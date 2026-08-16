-- Phase 18 (Premium Listing Detail Experience) — structured, partner-
-- authored content the Generic Attribute Engine (migration 0014) cannot
-- express, since it only supports scalar/enum values, not ordered lists
-- of free text. Four small, simple per-listing child tables, following
-- the exact same "id, listing_id FK, ..., sort_order, created_at/
-- updated_at, created_by/updated_by" shape `blackout_dates` (migration
-- 0007) already established for listing-scoped child rows.
--
-- All four are partner-authored only (written through the Partner
-- Listing Wizard, never auto-generated) — this deliberately avoids the
-- "silently publish hallucinated facts as listing truth" risk the phase
-- brief calls out for AI-assisted content.

CREATE TABLE IF NOT EXISTS listing_highlights (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  icon_code VARCHAR(40) NOT NULL,
  text VARCHAR(150) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_listing_highlights_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_highlights_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_listing_highlights_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  KEY idx_listing_highlights_listing_id (listing_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tour/experience itinerary — an ordered sequence of stops/steps. Kept
-- generic (title/description/duration) rather than tour-specific columns
-- so any category could adopt it later without a new table.
CREATE TABLE IF NOT EXISTS listing_itinerary_steps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  duration_minutes INT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_listing_itinerary_steps_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_itinerary_steps_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_listing_itinerary_steps_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  KEY idx_listing_itinerary_steps_listing_id (listing_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "What's included" / "What's not included" — one flat list, distinguished
-- by `is_included`, rather than two separate tables (same row shape,
-- just a boolean split — mirrors how `attribute_options`/etc. avoid
-- needless table proliferation for a single boolean distinction).
CREATE TABLE IF NOT EXISTS listing_included_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  item_text VARCHAR(200) NOT NULL,
  is_included TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_listing_included_items_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_included_items_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_listing_included_items_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  KEY idx_listing_included_items_listing_id (listing_id, is_included, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_faqs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  question VARCHAR(255) NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_listing_faqs_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_faqs_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_listing_faqs_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  KEY idx_listing_faqs_listing_id (listing_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
