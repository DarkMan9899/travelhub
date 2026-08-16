-- Phase 17: Inventory, Availability & Connectivity Platform.
--
-- Deliberately builds ON TOP OF the existing Sprint 9/10 engine rather
-- than replacing it: `bookable_units`, `availability_calendar`,
-- `reservation_holds`, and `blackout_dates` (migration 0007) remain the
-- authoritative capacity/veto store. This migration adds three additive
-- columns to `bookable_units` (so a category with multiple daily
-- departures/slots — Tours, Activities — registers one bookable_unit
-- PER SLOT and gets the exact same per-date capacity engine every other
-- category already uses, never a parallel time-slot system), plus seven
-- new tables that all funnel their capacity effect through the SAME
-- `availability_calendar.quantity_available` column via the SAME
-- `lockForCapacity` row-locking path `AvailabilityService#reserveCapacity`
-- already uses (see `services/availabilityService.js`) — so "prevent
-- double booking" has exactly one transactional choke point regardless
-- of whether the consumer is a TravelHub hold, a manual block, a phone
-- reservation, or a synced external calendar event.
--
-- Small closed vocabularies (`reason_code`, `source_code`,
-- `connector_type`, `direction`, `status`, `trigger_code`,
-- `conflict_type`, `source_type`) are plain VARCHAR columns, not lookup
-- tables — mirrors migration 0024's `payment_transactions.type`/
-- `financial_ledger_entries.entry_type` precedent (the most recent
-- architectural judgment in this codebase: a value with no admin-facing
-- CRUD need and a small, code-owned vocabulary doesn't need a table).

ALTER TABLE bookable_units
  ADD COLUMN time_slot_start TIME NULL AFTER capacity,
  ADD COLUMN time_slot_end TIME NULL AFTER time_slot_start,
  ADD COLUMN unit_label VARCHAR(120) NULL AFTER time_slot_end;

-- Manual, quantity-aware capacity blocks — NOT bookings (spec §11).
-- "Quantity aware" so a manager can block 3 of an 8-seat activity slot
-- without lying about the other 5 seats' availability; a full block is
-- simply `quantity = the unit's total capacity` at write time.
CREATE TABLE IF NOT EXISTS inventory_blocks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  reason_code VARCHAR(30) NOT NULL,
  notes VARCHAR(500) NULL,
  released_at DATETIME(3) NULL,
  released_by BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_inventory_blocks_bookable_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  CONSTRAINT fk_inventory_blocks_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  CONSTRAINT fk_inventory_blocks_released_by FOREIGN KEY (released_by) REFERENCES users (id),
  KEY idx_inventory_blocks_unit_dates (bookable_unit_id, date_from, date_to),
  KEY idx_inventory_blocks_unit_released (bookable_unit_id, released_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One connector instance per partner/listing (spec §15-17). Scoped at
-- listing level (not bookable_unit level) because one external feed
-- commonly covers several room types/vehicles at once — resolved down to
-- specific units via `inventory_connection_mappings`, not here.
CREATE TABLE IF NOT EXISTS inventory_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  partner_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NULL,
  connector_type VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  name VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  config JSON NULL,
  webhook_secret VARCHAR(128) NULL,
  export_token VARCHAR(64) NULL,
  last_attempted_sync_at DATETIME(3) NULL,
  last_successful_sync_at DATETIME(3) NULL,
  last_error VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_inventory_connections_export_token UNIQUE (export_token),
  CONSTRAINT fk_inventory_connections_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_inventory_connections_listing_id FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_inventory_connections_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  KEY idx_inventory_connections_partner_status (partner_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- External-system resource id <-> our bookable_unit_id (spec §18).
CREATE TABLE IF NOT EXISTS inventory_connection_mappings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  connection_id BIGINT UNSIGNED NOT NULL,
  external_resource_id VARCHAR(150) NOT NULL,
  external_resource_name VARCHAR(200) NULL,
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_inventory_connection_mappings UNIQUE (connection_id, external_resource_id),
  CONSTRAINT fk_inventory_connection_mappings_connection_id FOREIGN KEY (connection_id) REFERENCES inventory_connections (id),
  CONSTRAINT fk_inventory_connection_mappings_bookable_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Normalized external occupancy — phone/walk-in/OTA recorded manually, OR
-- imported by a connector (spec §10, §19-21). `connection_id` NULL means
-- a human entered it directly (no connector involved); `external_event_uid`
-- is the connector's own stable id (e.g. an iCal UID or CSV row key) used
-- for idempotent re-import. MySQL treats NULL as distinct in a UNIQUE
-- index, so any number of manually-entered rows (`connection_id` NULL)
-- coexist safely — only connector-sourced rows are deduplicated.
CREATE TABLE IF NOT EXISTS external_reservations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  source_code VARCHAR(30) NOT NULL,
  external_reference VARCHAR(120) NULL,
  guest_name VARCHAR(150) NULL,
  guest_phone VARCHAR(40) NULL,
  guest_email VARCHAR(190) NULL,
  notes VARCHAR(500) NULL,
  connection_id BIGINT UNSIGNED NULL,
  external_event_uid VARCHAR(255) NULL,
  cancelled_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_external_reservations_connection_uid UNIQUE (connection_id, external_event_uid),
  CONSTRAINT fk_external_reservations_bookable_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  CONSTRAINT fk_external_reservations_connection_id FOREIGN KEY (connection_id) REFERENCES inventory_connections (id),
  CONSTRAINT fk_external_reservations_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  KEY idx_external_reservations_unit_dates (bookable_unit_id, date_from, date_to),
  KEY idx_external_reservations_unit_cancelled (bookable_unit_id, cancelled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sync run history (spec §27-28).
CREATE TABLE IF NOT EXISTS inventory_sync_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  connection_id BIGINT UNSIGNED NOT NULL,
  direction VARCHAR(10) NOT NULL,
  trigger_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3) NULL,
  records_received INT UNSIGNED NOT NULL DEFAULT 0,
  records_created INT UNSIGNED NOT NULL DEFAULT 0,
  records_updated INT UNSIGNED NOT NULL DEFAULT 0,
  records_skipped INT UNSIGNED NOT NULL DEFAULT 0,
  conflicts_count INT UNSIGNED NOT NULL DEFAULT 0,
  error_message VARCHAR(500) NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_inventory_sync_runs_connection_id FOREIGN KEY (connection_id) REFERENCES inventory_connections (id),
  KEY idx_inventory_sync_runs_connection_started (connection_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unresolved sync conflicts surfaced to Partner/Admin (spec §26).
CREATE TABLE IF NOT EXISTS inventory_sync_conflicts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sync_run_id BIGINT UNSIGNED NOT NULL,
  connection_id BIGINT UNSIGNED NOT NULL,
  external_event_uid VARCHAR(255) NULL,
  conflict_type VARCHAR(30) NOT NULL,
  details JSON NULL,
  resolved_at DATETIME(3) NULL,
  resolved_by BIGINT UNSIGNED NULL,
  resolution_note VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_inventory_sync_conflicts_sync_run_id FOREIGN KEY (sync_run_id) REFERENCES inventory_sync_runs (id),
  CONSTRAINT fk_inventory_sync_conflicts_connection_id FOREIGN KEY (connection_id) REFERENCES inventory_connections (id),
  CONSTRAINT fk_inventory_sync_conflicts_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (id),
  KEY idx_inventory_sync_conflicts_connection_resolved (connection_id, resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unified, source-polymorphic capacity audit trail (spec §29) — every
-- write to `availability_calendar.quantity_available`, from ANY source
-- (TravelHub hold/booking, manual block, external reservation, connector
-- sync, or a plain admin adjustment), gets exactly one row here. This is
-- how Admin/Support answer "why is this unavailable right now."
CREATE TABLE IF NOT EXISTS inventory_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  source_type VARCHAR(30) NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  delta INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_inventory_ledger_bookable_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  CONSTRAINT fk_inventory_ledger_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users (id),
  KEY idx_inventory_ledger_unit_date_created (bookable_unit_id, date, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
