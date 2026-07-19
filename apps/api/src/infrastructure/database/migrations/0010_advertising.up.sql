-- Featured Listings and Advertising Foundation (Sprint 5 §11). Extends
-- API_SPECIFICATION.md §64's already-reserved "Advertisements" concept
-- (premium listing / featured placement, pending_review -> active
-- admin-approval workflow) with Sprint 5's fuller placement/product/
-- status model. Not present in DATABASE_ARCHITECTURE.md's 66-table
-- catalog — new, additive.
--
-- "Placement slots" (Sprint 5's wording for reservable homepage/category
-- areas) is deliberately modeled as `max_concurrent_slots` on
-- `ad_placement_types` rather than a separate slot-assignment table —
-- actually rotating/assigning which concurrent slot an active ad
-- occupies is feature-API behavior for the sprint that builds the
-- homepage rendering logic, not foundation schema.
--
-- "Custom admin-defined period" (alongside the 7/30/90-day catalog
-- tiers) needs no special-case column: `advertisements.start_date`/
-- `end_date` are always the actual active period, independent of the
-- purchased `ad_products` row's nominal `duration_days` — an admin can
-- freely set any dates on the advertisement itself.

CREATE TABLE IF NOT EXISTS ad_placement_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  max_concurrent_slots INT UNSIGNED NULL COMMENT 'NULL = unlimited concurrent active ads for this placement',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_ad_placement_types_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ad_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ad_placement_type_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  duration_days INT UNSIGNED NULL COMMENT 'NULL = custom/admin-defined period product',
  price_amount DECIMAL(12,2) NOT NULL,
  currency_id BIGINT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_ad_products_ad_placement_type_id FOREIGN KEY (ad_placement_type_id) REFERENCES ad_placement_types (id),
  CONSTRAINT fk_ad_products_currency_id FOREIGN KEY (currency_id) REFERENCES currencies (id),
  KEY idx_ad_products_ad_placement_type_id (ad_placement_type_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Because online payment is unavailable this release, the workflow
-- includes explicit manual-payment states (Sprint 5 §11).
CREATE TABLE IF NOT EXISTS advertisement_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_advertisement_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS advertisements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  -- Denormalized from listings.partner_id — partner-scoped ad dashboards
  -- query this directly without a join through listings.
  partner_id BIGINT UNSIGNED NOT NULL,
  ad_placement_type_id BIGINT UNSIGNED NOT NULL,
  ad_product_id BIGINT UNSIGNED NOT NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  -- Price is snapshotted at request time (DATABASE_ARCHITECTURE.md §11:
  -- "fully traceable, never recomputed retroactively") — never re-read
  -- from ad_products, which may change price later.
  price_snapshot_amount DECIMAL(12,2) NOT NULL,
  currency_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  display_priority INT NOT NULL DEFAULT 0,
  impression_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  click_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  requested_by BIGINT UNSIGNED NOT NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME(3) NULL,
  payment_marked_paid_by BIGINT UNSIGNED NULL COMMENT 'Admin who manually marked this paid',
  payment_marked_paid_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_advertisements_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_advertisements_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_advertisements_ad_placement_type_id FOREIGN KEY (ad_placement_type_id) REFERENCES ad_placement_types (id),
  CONSTRAINT fk_advertisements_ad_product_id FOREIGN KEY (ad_product_id) REFERENCES ad_products (id),
  CONSTRAINT fk_advertisements_status_id FOREIGN KEY (status_id) REFERENCES advertisement_statuses (id),
  CONSTRAINT fk_advertisements_currency_id FOREIGN KEY (currency_id) REFERENCES currencies (id),
  CONSTRAINT fk_advertisements_requested_by FOREIGN KEY (requested_by) REFERENCES users (id),
  CONSTRAINT fk_advertisements_approved_by FOREIGN KEY (approved_by) REFERENCES users (id),
  CONSTRAINT fk_advertisements_payment_marked_paid_by FOREIGN KEY (payment_marked_paid_by) REFERENCES users (id),
  CONSTRAINT fk_advertisements_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_advertisements_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_advertisements_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  -- Hot read path: "active ads for this placement, ordered by priority",
  -- the homepage/category rendering query.
  KEY idx_advertisements_placement_status_priority (ad_placement_type_id, status_id, display_priority),
  KEY idx_advertisements_partner_id (partner_id),
  KEY idx_advertisements_listing_id (listing_id),
  KEY idx_advertisements_deleted_at_id (deleted_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
