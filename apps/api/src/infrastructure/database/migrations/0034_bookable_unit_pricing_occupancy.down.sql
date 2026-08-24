ALTER TABLE bookable_units
  DROP FOREIGN KEY fk_bookable_units_base_price_currency,
  DROP COLUMN base_price_currency_id,
  DROP COLUMN base_price_amount,
  DROP COLUMN bed_configuration,
  DROP COLUMN max_guests;
