-- Marketplace Product Completeness Sprint C-1: room-level product data
-- for `bookable_units` (Accommodation audit finding — a `bookable_units`
-- row already represents a room TYPE; this migration adds the structured
-- product information a Hotel Partner needs to make one genuinely
-- sellable, without touching `capacity`'s existing "pooled room
-- quantity" meaning or `max_guests`'s existing "guest occupancy" meaning).
--
-- Four structured, nullable columns directly on `bookable_units`:
--
--   room_size_sqm     — canonical metric numeric value (never a formatted
--                        string like "32 m²"; presentation formats it).
--   bathroom_type      \
--   view_type           } small, code-owned closed vocabularies, the
--   smoking_policy     / exact same pattern this table's own
--                        `bed_configuration` JSON `type` field already
--                        established (migration 0034's own comment: "a
--                        small closed set validated at the Zod layer...
--                        mirroring migration 0025's own 'small closed
--                        vocabularies don't need a lookup table'
--                        judgment") — see core/domain/roomAttributes.js
--                        for the closed lists these three VARCHAR columns
--                        are validated against. Deliberately NOT a new
--                        lookup table with an FK: unlike `amenity_groups`
--                        (a genuinely admin-curated, growing vocabulary)
--                        these three are fixed, small, rarely-changing
--                        sets with no per-row metadata of their own.
--
-- All four apply in principle to any bookable_unit type (a car could
-- have a "trunk size," a tour could note "smoking break allowed") but are
-- deliberately left generically named/typed rather than HOTEL_ROOM-
-- specific columns — exactly mirroring migration 0034's own
-- `max_guests`/`bed_configuration` precedent. The Partner UI (not the
-- schema) is what gates these fields to HOTEL_ROOM units.
--
-- `bookable_unit_translations` — room description, genuinely multilingual
-- authored content. Mirrors `listing_translations` (migration 0005)
-- exactly: one canonical shared entity (`bookable_units`), one child row
-- per (unit, language) pair, UNIQUE-keyed, upserted the identical way
-- (`INSERT ... ON DUPLICATE KEY UPDATE`). A missing locale is a missing
-- row, never a silently-borrowed value from another locale.
--
-- `bookable_unit_amenity_listing` — room-specific amenities. Reuses the
-- EXISTING `listing_amenities`/`listing_amenity_translations`/
-- `amenity_groups` catalog verbatim (no parallel amenity vocabulary,
-- no free-text/JSON duplication) — mirrors `listing_amenity_listing`
-- (migration 0005) exactly, just keyed on `bookable_unit_id` instead of
-- `listing_id`. The same amenity (e.g. "Air Conditioning") can
-- legitimately apply at both listing level (a building has central AC)
-- and room level (this specific room has its own unit) — that overlap is
-- correct, not a modeling bug, so no new scoping/applicability table is
-- introduced for this join.
--
-- Room photos need NO new table at all: `media.mediable_type`/
-- `mediable_id` (migration 0006) is already a generic polymorphic pointer
-- with no FK constraint on the pair — `mediable_type = 'bookable_unit'`
-- is a purely additive new value in that existing column, exactly the
-- same way `mediable_type = 'message'` (migration 0022) and
-- `mediable_type = 'partner'` were added with zero schema change.
--
-- Every new column is nullable and every new table is purely additive:
-- every existing bookable_unit (hotel, property, tour, vehicle alike)
-- and every historical booking keeps working completely unchanged.

ALTER TABLE bookable_units
  ADD COLUMN room_size_sqm DECIMAL(6,2) NULL AFTER base_price_currency_id,
  ADD COLUMN bathroom_type VARCHAR(20) NULL AFTER room_size_sqm,
  ADD COLUMN view_type VARCHAR(20) NULL AFTER bathroom_type,
  ADD COLUMN smoking_policy VARCHAR(20) NULL AFTER view_type;

CREATE TABLE IF NOT EXISTS bookable_unit_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  description TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_bookable_unit_translations_unit_id_language_id UNIQUE (bookable_unit_id, language_id),
  CONSTRAINT fk_bookable_unit_translations_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  CONSTRAINT fk_bookable_unit_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookable_unit_amenity_listing (
  bookable_unit_id BIGINT UNSIGNED NOT NULL,
  amenity_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (bookable_unit_id, amenity_id),
  CONSTRAINT fk_bookable_unit_amenity_listing_unit_id FOREIGN KEY (bookable_unit_id) REFERENCES bookable_units (id),
  CONSTRAINT fk_bookable_unit_amenity_listing_amenity_id FOREIGN KEY (amenity_id) REFERENCES listing_amenities (id),
  KEY idx_bookable_unit_amenity_listing_amenity_id (amenity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
