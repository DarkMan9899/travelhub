-- Booking Foundation, MVP no-payment-gateway model (Sprint 5 §9).
-- DATABASE_ARCHITECTURE.md §4.8 shape (bookings/booking_items/
-- booking_guests/booking_status_history), but `booking_statuses` and
-- `payment_statuses` are seeded with Sprint 5's simpler v1 vocabulary
-- (request -> vendor confirm/reject -> pay at property -> cancel/
-- complete) instead of BOOKING_ENGINE_ARCHITECTURE.md's 11-status,
-- payment-gateway-dependent machine — see docs/SPRINT_5_DATABASE_
-- FOUNDATION.md "Architecture Decisions" for the full amendment
-- rationale. Both are lookup tables, so the full machine can be
-- reintroduced later as a data change, not a schema fork.
--
-- No `payments`/`payment_transactions`/`refunds`/`invoices` tables — out
-- of scope per Sprint 5 §18 (no online payment gateway, no checkout).

CREATE TABLE IF NOT EXISTS booking_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_booking_types_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_booking_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_payment_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_reference VARCHAR(30) NOT NULL,
  customer_user_id BIGINT UNSIGNED NOT NULL,
  partner_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  booking_type_id BIGINT UNSIGNED NOT NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  customer_notes TEXT NULL,
  vendor_notes TEXT NULL,
  -- Snapshot of the customer's contact details at booking time (name/
  -- email/phone) — the booking record must stay accurate even if the
  -- customer later edits their profile.
  guest_contact_snapshot JSON NOT NULL,
  currency_id BIGINT UNSIGNED NOT NULL,
  subtotal_amount DECIMAL(12,2) NOT NULL,
  fees_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL,
  -- Single fixed value this release ('offline'); a plain column rather
  -- than a lookup table or CHECK constraint so introducing online payment
  -- later is a data/application change, not a schema migration.
  payment_method VARCHAR(20) NOT NULL DEFAULT 'offline',
  payment_status_id BIGINT UNSIGNED NOT NULL,
  requested_at DATETIME(3) NOT NULL,
  confirmed_at DATETIME(3) NULL,
  rejected_at DATETIME(3) NULL,
  cancelled_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  cancellation_reason VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_bookings_booking_reference UNIQUE (booking_reference),
  CONSTRAINT fk_bookings_customer_user_id FOREIGN KEY (customer_user_id) REFERENCES users (id),
  CONSTRAINT fk_bookings_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_bookings_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_bookings_booking_type_id FOREIGN KEY (booking_type_id) REFERENCES booking_types (id),
  CONSTRAINT fk_bookings_status_id FOREIGN KEY (status_id) REFERENCES booking_statuses (id),
  CONSTRAINT fk_bookings_currency_id FOREIGN KEY (currency_id) REFERENCES currencies (id),
  CONSTRAINT fk_bookings_payment_status_id FOREIGN KEY (payment_status_id) REFERENCES payment_statuses (id),
  CONSTRAINT fk_bookings_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_bookings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_bookings_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  -- "My Trips" and support lookups (DATABASE_ARCHITECTURE.md §6.2).
  KEY idx_bookings_customer_user_id_status_id_created_at (customer_user_id, status_id, created_at),
  KEY idx_bookings_partner_id_status_id_created_at (partner_id, status_id, created_at),
  KEY idx_bookings_deleted_at_id (deleted_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  date_from DATE NULL,
  date_to DATE NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price_amount DECIMAL(12,2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_booking_items_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id),
  CONSTRAINT fk_booking_items_bookable_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  KEY idx_booking_items_booking_id (booking_id),
  -- Conflict detection and reporting (DATABASE_ARCHITECTURE.md §6.2).
  KEY idx_booking_items_unit_id_date_from_date_to (bookable_unit_id, date_from, date_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_guests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_item_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  document_number VARCHAR(100) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_booking_guests_booking_item_id FOREIGN KEY (booking_item_id) REFERENCES booking_items (id),
  KEY idx_booking_guests_booking_item_id (booking_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only audit trail of status transitions — every booking status
-- change is written here in the same transaction as the change itself
-- (BACKEND_ARCHITECTURE.md §97/§99 "every state transition is atomic and
-- auditable").
CREATE TABLE IF NOT EXISTS booking_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  from_status_id BIGINT UNSIGNED NULL,
  to_status_id BIGINT UNSIGNED NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_booking_status_history_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id),
  CONSTRAINT fk_booking_status_history_from_status_id FOREIGN KEY (from_status_id) REFERENCES booking_statuses (id),
  CONSTRAINT fk_booking_status_history_to_status_id FOREIGN KEY (to_status_id) REFERENCES booking_statuses (id),
  CONSTRAINT fk_booking_status_history_changed_by FOREIGN KEY (changed_by) REFERENCES users (id),
  KEY idx_booking_status_history_booking_id (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
