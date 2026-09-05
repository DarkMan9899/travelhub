-- Marketplace Product Completeness Sprint A: time-aware booking foundation.
--
-- `bookable_units.time_slot_start`/`time_slot_end` (migration 0025) have
-- always been real, partner-authored `TIME` columns — but nothing on
-- `booking_items` ever snapshotted them, so a completed Tour/Attraction
-- booking's exact departure time only ever survived as whatever free text
-- a partner happened to type into `unit_label` (e.g. "09:00 Departure").
-- This mirrors migration 0035's `unit_label_snapshot` precedent exactly:
-- purely additive, nullable `TIME` columns, snapshotted once at
-- booking-creation time (`bookingService.js#createBooking`) from the
-- selected unit's own `time_slot_start`/`time_slot_end` — never a value
-- the client supplies, so there is nothing here for a client to tamper
-- with (the existing `bookable_unit_id`-only hold/booking payload is
-- unchanged; time is derived server-side, never accepted as input).
--
-- Nullable and backward compatible by construction: a unit with no time
-- slot (every Hotel/Property/Restaurant/Car Rental unit today, and any
-- date-only Tour/Attraction unit) simply gets `NULL` in both columns, the
-- same as every booking_item row created before this migration. No
-- backfill — like 0035, a historical row's true selected time (if any)
-- is not knowable after the fact from `unit_label` free text alone.

ALTER TABLE booking_items
  ADD COLUMN start_time TIME NULL AFTER date_to,
  ADD COLUMN end_time TIME NULL AFTER start_time;
