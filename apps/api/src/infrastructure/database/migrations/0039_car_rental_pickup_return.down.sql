ALTER TABLE booking_items
  DROP COLUMN pickup_location_snapshot,
  DROP COLUMN return_location_snapshot;

ALTER TABLE reservation_holds
  DROP COLUMN start_time,
  DROP COLUMN end_time;
