-- Marketplace Listing Foundation (Sprint 5 §7) + SEO Foundation (§12).
-- DATABASE_ARCHITECTURE.md §4.3. Only truly shared fields live here —
-- category-specific attributes (star ratings, room types, cuisine, ...)
-- are explicitly deferred to per-type extension tables in a future
-- sprint, one per listing_type, each sharing its `listings.id` as its own
-- PK (DATABASE_ARCHITECTURE.md §5.1's documented shared-PK 1:1 pattern) —
-- this migration does not create any of those extension tables.
--
-- SEO fields split: seo_title/seo_description are locale-specific and
-- live on listing_translations; canonical_url/og_image/indexability are
-- one-per-listing and live on listings.
--
-- is_featured is an intentionally denormalized read flag (DATABASE_
-- ARCHITECTURE.md §1 explicitly allows this for read-heavy catalog
-- tables) kept in sync by the Advertising module (migration 0010) when a
-- promotion activates/expires — avoids a join on every listing-card
-- render just to know whether to show a "featured" badge.

CREATE TABLE IF NOT EXISTS listing_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_listing_types_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_listing_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  partner_id BIGINT UNSIGNED NOT NULL,
  listing_type_id BIGINT UNSIGNED NOT NULL,
  slug VARCHAR(180) NOT NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  moderation_status_id BIGINT UNSIGNED NOT NULL,
  is_contact_visible TINYINT(1) NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Denormalized from advertisements (migration 0010)',
  published_at DATETIME(3) NULL,
  unpublished_at DATETIME(3) NULL,
  canonical_url VARCHAR(500) NULL,
  og_image_media_id BIGINT UNSIGNED NULL COMMENT 'Soft reference to media.id (migration 0006)',
  is_indexable TINYINT(1) NOT NULL DEFAULT 1,
  is_sitemap_included TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  active_slug VARCHAR(180) GENERATED ALWAYS AS (IF(deleted_at IS NULL, slug, NULL)) STORED,
  PRIMARY KEY (id),
  CONSTRAINT uq_listings_active_slug UNIQUE (active_slug),
  CONSTRAINT fk_listings_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_listings_listing_type_id FOREIGN KEY (listing_type_id) REFERENCES listing_types (id),
  CONSTRAINT fk_listings_status_id FOREIGN KEY (status_id) REFERENCES listing_statuses (id),
  CONSTRAINT fk_listings_moderation_status_id FOREIGN KEY (moderation_status_id) REFERENCES moderation_statuses (id),
  CONSTRAINT fk_listings_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_listings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_listings_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  -- Partner dashboard listing table, paginated/filtered by status
  -- (DATABASE_ARCHITECTURE.md §6.2).
  KEY idx_listings_partner_id_status_id_created_at (partner_id, status_id, created_at),
  KEY idx_listings_listing_type_id (listing_type_id),
  KEY idx_listings_deleted_at_id (deleted_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary VARCHAR(500) NULL,
  description TEXT NULL,
  seo_title VARCHAR(255) NULL,
  seo_description VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_listing_translations_listing_id_language_id UNIQUE (listing_id, language_id),
  CONSTRAINT fk_listing_translations_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id),
  FULLTEXT KEY ft_listing_translations_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1:1 with listings. Latitude/longitude are plain DECIMAL columns rather
-- than a SPATIAL POINT column for this foundation sprint (radius/"near
-- me" search is explicitly out of scope, Sprint 5 §18) — documented as a
-- deferred enhancement in docs/SPRINT_5_DATABASE_FOUNDATION.md, additive
-- when the Search module needs it (DATABASE_ARCHITECTURE.md §6.2).
CREATE TABLE IF NOT EXISTS listing_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  address_id BIGINT UNSIGNED NULL,
  city_id BIGINT UNSIGNED NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_listing_locations_listing_id UNIQUE (listing_id),
  CONSTRAINT fk_listing_locations_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_locations_address_id FOREIGN KEY (address_id) REFERENCES addresses (id),
  CONSTRAINT fk_listing_locations_city_id FOREIGN KEY (city_id) REFERENCES cities (id),
  KEY idx_listing_locations_city_id (city_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_category_listing (
  listing_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (listing_id, category_id),
  CONSTRAINT fk_listing_category_listing_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_category_listing_category_id FOREIGN KEY (category_id) REFERENCES listing_categories (id),
  KEY idx_listing_category_listing_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_amenity_listing (
  listing_id BIGINT UNSIGNED NOT NULL,
  amenity_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (listing_id, amenity_id),
  CONSTRAINT fk_listing_amenity_listing_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_amenity_listing_amenity_id FOREIGN KEY (amenity_id) REFERENCES listing_amenities (id),
  KEY idx_listing_amenity_listing_amenity_id (amenity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_tag (
  listing_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (listing_id, tag_id),
  CONSTRAINT fk_listing_tag_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_tag_tag_id FOREIGN KEY (tag_id) REFERENCES tags (id),
  KEY idx_listing_tag_tag_id (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SEO Foundation (Sprint 5 §12): "redirect readiness" — every previous
-- slug a listing has ever had, so a future redirect middleware can 301
-- an old URL to the current one instead of 404ing.
CREATE TABLE IF NOT EXISTS listing_slug_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  old_slug VARCHAR(180) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_listing_slug_history_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  KEY idx_listing_slug_history_old_slug (old_slug),
  KEY idx_listing_slug_history_listing_id (listing_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
