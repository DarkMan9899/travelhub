DROP TABLE IF EXISTS filter_definition_translations;
DROP TABLE IF EXISTS filter_definitions;
DROP TABLE IF EXISTS filter_input_types;
DROP TABLE IF EXISTS filter_group_translations;
DROP TABLE IF EXISTS filter_groups;

DROP TABLE IF EXISTS amenity_category_applicability;
ALTER TABLE listing_amenities
  DROP FOREIGN KEY fk_listing_amenities_group_id,
  DROP COLUMN amenity_group_id;
DROP TABLE IF EXISTS amenity_groups;

DROP TABLE IF EXISTS listing_attribute_option;
DROP TABLE IF EXISTS listing_attribute_values_date;
DROP TABLE IF EXISTS listing_attribute_values_string;
DROP TABLE IF EXISTS listing_attribute_values_boolean;
DROP TABLE IF EXISTS listing_attribute_values_decimal;
DROP TABLE IF EXISTS listing_attribute_values_integer;
DROP TABLE IF EXISTS category_attributes;
DROP TABLE IF EXISTS attribute_option_translations;
DROP TABLE IF EXISTS attribute_options;
DROP TABLE IF EXISTS attribute_definition_translations;
DROP TABLE IF EXISTS attribute_definitions;
DROP TABLE IF EXISTS attribute_data_types;
