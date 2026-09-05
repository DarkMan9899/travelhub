-- Marketplace Product Completeness Sprint B: Car Rental pickup/return
-- interval + location.
--
-- Time: reuses Sprint A's `booking_items.start_time`/`end_time` exactly as
-- designed — `date_from`+`start_time` is the pickup datetime, `date_to`+
-- `end_time` the return datetime. No new time columns on `booking_items`.
-- Unlike a Tour departure (whose time is fixed at authoring time on the
-- `bookable_unit` itself), a rental's pickup/return time is a genuine
-- customer choice with no unit-level default to derive it from — so
-- `reservation_holds` needs its own nullable `start_time`/`end_time` to
-- carry that choice from hold-creation (where it is validated once,
-- server-side) through to booking-creation (`BookingService#resolveItem`
-- reads it back off the consumed hold, exactly the same way it already
-- reads `start_date`/`end_date` — never re-trusting fresh client input).
--
-- Location: `listing_locations` is 1:1 per listing (migration 0005) — this
-- platform has no multi-location-per-listing model, so a rental's pickup
-- and return location are today always the listing's own single
-- registered location (same-location return only; there is no one-way
-- rental capability to represent). `booking_items` gains
-- `pickup_location_snapshot`/`return_location_snapshot`, following the
-- exact `unit_label_snapshot` (migration 0035) precedent: a point-in-time
-- display string ("Yerevan, Armenia"), not a live FK, so a booking's
-- pickup/return location keeps its historical meaning even if the
-- partner's listing address changes later. Both columns are populated
-- identically today; keeping them as two independent fields (rather than
-- one shared "location") costs nothing now and needs no later migration
-- if one-way rental support is ever added.
--
-- All columns nullable and purely additive — historical and non-vehicle
-- bookings are completely unaffected.

ALTER TABLE reservation_holds
  ADD COLUMN start_time TIME NULL AFTER end_date,
  ADD COLUMN end_time TIME NULL AFTER start_time;

ALTER TABLE booking_items
  ADD COLUMN pickup_location_snapshot VARCHAR(255) NULL AFTER end_time,
  ADD COLUMN return_location_snapshot VARCHAR(255) NULL AFTER pickup_location_snapshot;
