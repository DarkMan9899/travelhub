-- P2.2E: historical booking integrity — snapshot the booked unit's label.
--
-- `booking_items` never persisted the room/unit label; every read
-- LEFT JOINs the live `bookable_units.unit_label` (mysqlBookingRepository.js
-- #findItemsForBooking), so a partner renaming a unit after a booking
-- exists silently rewrites that booking's displayed room name on every
-- past booking record — customer, partner, and admin alike.
--
-- Purely additive and nullable, matching migration 0025's own
-- `bookable_units.unit_label VARCHAR(120) NULL` precedent exactly (same
-- type/length, same "small denormalized label" pattern). No backfill: a
-- historical row's true label at booking time is not knowable after the
-- fact, so guessing one from the unit's *current* label would just move
-- the same correctness bug earlier instead of fixing it. Every row created
-- before this migration keeps `unit_label_snapshot IS NULL` and the
-- repository read path falls back to the pre-existing live JOIN for those
-- rows only; every row created after this migration gets a real snapshot
-- taken at booking-creation time and never falls back again.

ALTER TABLE booking_items
  ADD COLUMN unit_label_snapshot VARCHAR(120) NULL AFTER bookable_unit_id;
