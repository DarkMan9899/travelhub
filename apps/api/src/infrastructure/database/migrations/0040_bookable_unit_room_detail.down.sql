DROP TABLE IF EXISTS bookable_unit_amenity_listing;
DROP TABLE IF EXISTS bookable_unit_translations;

ALTER TABLE bookable_units
  DROP COLUMN smoking_policy,
  DROP COLUMN view_type,
  DROP COLUMN bathroom_type,
  DROP COLUMN room_size_sqm;
