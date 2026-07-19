-- Booking Foundation, availability core (Sprint 5 §9). DATABASE_
-- ARCHITECTURE.md §4.6 / §10.1: every reservable thing (a hotel room, a
-- rental car, a restaurant table, a tour departure, a spa slot, a vehicle
-- date range) is normalized into one `bookable_units` table, linked back
-- to its module-specific source row via source_table/source_id — this is
-- the extension point Sprint 5 §9 asks for. No module-specific extension
-- tables (hotel_rooms, tour_departures, ...) exist yet; those are
-- future-sprint work per Sprint 5 §18 ("Do not implement category-
-- specific availability logic in this sprint").

CREATE TABLE IF NOT EXISTS bookable_unit_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_bookable_unit_types_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS availability_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_availability_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookable_units (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  bookable_unit_type_id BIGINT UNSIGNED NOT NULL,
  -- Polymorphic pointer to the future module-specific inventory row
  -- (e.g. hotel_rooms.id, tour_departures.id) — no formal FK, since those
  -- extension tables don't exist yet (future sprint).
  source_table VARCHAR(64) NOT NULL,
  source_id BIGINT UNSIGNED NOT NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  deleted_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_bookable_units_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_bookable_units_type_id FOREIGN KEY (bookable_unit_type_id) REFERENCES bookable_unit_types (id),
  CONSTRAINT fk_bookable_units_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_bookable_units_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  CONSTRAINT fk_bookable_units_deleted_by FOREIGN KEY (deleted_by) REFERENCES users (id),
  KEY idx_bookable_units_listing_id (listing_id),
  KEY idx_bookable_units_source_table_source_id (source_table, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per unit per date — the single most frequent read in the
-- platform ("is this unit free on this date?"), per DATABASE_
-- ARCHITECTURE.md §6.2. The composite UNIQUE also prevents duplicate
-- calendar rows.
CREATE TABLE IF NOT EXISTS availability_calendar (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  `date` DATE NOT NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  price_override_amount DECIMAL(12,2) NULL,
  price_override_currency_id BIGINT UNSIGNED NULL,
  quantity_available INT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_availability_calendar_unit_id_date UNIQUE (bookable_unit_id, `date`),
  CONSTRAINT fk_availability_calendar_bookable_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  CONSTRAINT fk_availability_calendar_status_id FOREIGN KEY (status_id) REFERENCES availability_statuses (id),
  CONSTRAINT fk_availability_calendar_currency_id FOREIGN KEY (price_override_currency_id) REFERENCES currencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Short-lived lock preventing double-booking during checkout. Ephemeral
-- by design (created, then deleted on conversion-to-booking or on expiry
-- by a scheduled job per DATABASE_ARCHITECTURE.md §10.2) — no
-- soft-delete/updated_at, matching that create-then-delete lifecycle.
CREATE TABLE IF NOT EXISTS reservation_holds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_reservation_holds_bookable_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  CONSTRAINT fk_reservation_holds_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  -- Background job scans and releases expired holds (DATABASE_ARCHITECTURE.md §6.2).
  KEY idx_reservation_holds_expires_at (expires_at),
  -- Fast overlap-check before granting a new hold.
  KEY idx_reservation_holds_unit_id_start_date_end_date (bookable_unit_id, start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partner-defined dates a listing or a specific unit is closed
-- (maintenance, personal use), independent of the booking flow.
CREATE TABLE IF NOT EXISTS blackout_dates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NULL,
  bookable_unit_id BIGINT UNSIGNED NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_blackout_dates_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_blackout_dates_bookable_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  CONSTRAINT fk_blackout_dates_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_blackout_dates_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
  KEY idx_blackout_dates_listing_id (listing_id),
  KEY idx_blackout_dates_bookable_unit_id (bookable_unit_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
