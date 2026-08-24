-- P2.2A: structured room/unit-type correctness for accommodation
-- (Hotels/Property audit finding — a `bookable_units` row already
-- represents a room TYPE and `capacity` already means "how many rooms of
-- that type exist," never guest occupancy; this migration adds the
-- occupancy/bed/price data that was genuinely missing, without touching
-- `capacity`'s existing meaning).
--
-- Purely additive, all four columns NULL-able: every existing
-- `bookable_units` row (hotel, property, tour, vehicle, restaurant-table
-- alike) keeps working unchanged, with no backfill/reseed required.
-- `max_guests` and `bed_configuration` apply to any bookable_unit type in
-- principle (a car could seat N, a table could seat N) but are left
-- generically named/typed rather than accommodation-specific columns,
-- matching migration 0025's own "additive columns directly on
-- bookable_units" precedent (time_slot_start/end, unit_label) rather than
-- inventing a parallel per-vertical table.
--
-- `bed_configuration` is JSON, not a fixed set of `num_king_beds`/
-- `num_queen_beds`/... columns: the real shape (which bed types exist, in
-- what count) is inherently variable, and this codebase already treats a
-- JSON column as the right tool for a small, code-owned, variable-shape
-- value (`inventory_connections.config`, `inventory_sync_conflicts.
-- details` — migration 0025). The bed *type* vocabulary itself is a small
-- closed set validated at the Zod layer (`core/domain/bedTypes.js`),
-- mirroring migration 0025's own "small closed vocabularies are
-- code-owned, not a lookup table" judgment — just enforced inside the
-- JSON array's `type` field instead of a literal VARCHAR column, since
-- there is no per-row need to filter/join on it.
--
-- `base_price_amount`/`base_price_currency_id` mirror `listing_pricing.
-- amount`/`currency_id` exactly (migration 0015) — same DECIMAL(12,2)
-- precision, same FK-to-currencies pattern — so a unit's base price reads
-- and writes exactly like the listing's own base price already does, just
-- one level more specific. This is a real per-unit BASE rate, distinct
-- from `availability_calendar.price_override_amount` (a per-date
-- override that already existed) — see `bookingService.js#resolveItem`'s
-- updated precedence comment for how the two now combine.

ALTER TABLE bookable_units
  ADD COLUMN max_guests SMALLINT UNSIGNED NULL AFTER capacity,
  ADD COLUMN bed_configuration JSON NULL AFTER max_guests,
  ADD COLUMN base_price_amount DECIMAL(12,2) NULL AFTER bed_configuration,
  ADD COLUMN base_price_currency_id BIGINT UNSIGNED NULL AFTER base_price_amount,
  ADD CONSTRAINT fk_bookable_units_base_price_currency
    FOREIGN KEY (base_price_currency_id) REFERENCES currencies (id);
