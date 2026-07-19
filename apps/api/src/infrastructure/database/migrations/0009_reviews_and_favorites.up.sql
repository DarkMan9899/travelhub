-- Reviews and Favorites Foundation (Sprint 5 §10). DATABASE_ARCHITECTURE.md
-- §4.9, with one deliberate simplification: Sprint 5 lists "vendor
-- response" as a single field of Review itself (not a separate entity),
-- so `vendor_response`/`vendor_responded_at` are columns on `reviews`
-- here rather than the documented separate `review_replies` table —
-- splitting into a dedicated table for threaded/multiple responses
-- remains a purely additive change later if ever needed.
--
-- `booking_id` is NOT NULL (every review is for a specific booking) but
-- the "must be a COMPLETED booking" / "one review per eligible booking"
-- rule is enforced at the Service layer once the Reviews module exists
-- (Sprint 5 explicitly excludes "full public review APIs" this sprint) —
-- the UNIQUE(booking_id) constraint below already guarantees at most one
-- review per booking at the database level.

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_user_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  title VARCHAR(255) NULL,
  content TEXT NULL,
  status_id BIGINT UNSIGNED NOT NULL COMMENT 'FK to moderation_statuses (migration 0003)',
  vendor_response TEXT NULL,
  vendor_responded_at DATETIME(3) NULL,
  moderated_by BIGINT UNSIGNED NULL,
  moderated_at DATETIME(3) NULL,
  moderation_notes VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT uq_reviews_booking_id UNIQUE (booking_id),
  CONSTRAINT fk_reviews_customer_user_id FOREIGN KEY (customer_user_id) REFERENCES users (id),
  CONSTRAINT fk_reviews_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id),
  CONSTRAINT fk_reviews_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_reviews_status_id FOREIGN KEY (status_id) REFERENCES moderation_statuses (id),
  CONSTRAINT fk_reviews_moderated_by FOREIGN KEY (moderated_by) REFERENCES users (id),
  CONSTRAINT fk_reviews_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_reviews_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_reviews_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  KEY idx_reviews_listing_id (listing_id),
  KEY idx_reviews_deleted_at_id (deleted_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_user_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_favorites_customer_user_id_listing_id UNIQUE (customer_user_id, listing_id),
  CONSTRAINT fk_favorites_customer_user_id FOREIGN KEY (customer_user_id) REFERENCES users (id),
  CONSTRAINT fk_favorites_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  KEY idx_favorites_listing_id (listing_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
