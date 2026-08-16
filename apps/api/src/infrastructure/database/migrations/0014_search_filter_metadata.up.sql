-- Generic Attribute Engine + Filter Metadata System (Phase 4.2, per
-- docs/SEARCH_ARCHITECTURE_PROPOSAL.md §2.3/§4). Additive only — no
-- existing table/column is altered except `listing_amenities` gaining
-- one nullable FK column.
--
-- Design summary (see the proposal doc for full rationale):
--   * attribute_definitions + typed value tables (one per primitive
--     data type) let a brand-new category's attributes be added as pure
--     data (no migration), while values stay properly typed/indexed —
--     this is "EAV with typed side tables," not a single untyped value
--     column.
--   * category_attributes + amenity_category_applicability are what
--     `GET /search/filters` derives per-category filter visibility from
--     — there is deliberately no separate "filter applies to category"
--     table to keep in sync with those two.
--   * filter_definitions.value_source points at either an attribute, an
--     amenity, or is static/global (keyword, sort, ...) — one metadata
--     model, three sources.

-- ---------------------------------------------------------------------
-- Generic Attribute Engine
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attribute_data_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,   -- INTEGER | DECIMAL | BOOLEAN | STRING | DATE | ENUM | MULTI_ENUM
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_attribute_data_types_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attribute_definitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(60) NOT NULL,
  data_type_id BIGINT UNSIGNED NOT NULL,
  unit VARCHAR(20) NULL,
  validation_min DECIMAL(18,4) NULL,
  validation_max DECIMAL(18,4) NULL,
  is_multi_valued TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_attribute_definitions_code UNIQUE (code),
  CONSTRAINT fk_attribute_definitions_data_type FOREIGN KEY (data_type_id) REFERENCES attribute_data_types (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attribute_definition_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_attribute_definition_translations_definition_id_language_id UNIQUE (attribute_definition_id, language_id),
  CONSTRAINT fk_attribute_definition_translations_definition_id FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id),
  CONSTRAINT fk_attribute_definition_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attribute_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(60) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_attribute_options_definition_id_code UNIQUE (attribute_definition_id, code),
  CONSTRAINT fk_attribute_options_definition_id FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attribute_option_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attribute_option_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_attribute_option_translations_option_id_language_id UNIQUE (attribute_option_id, language_id),
  CONSTRAINT fk_attribute_option_translations_option_id FOREIGN KEY (attribute_option_id) REFERENCES attribute_options (id),
  CONSTRAINT fk_attribute_option_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which attributes apply to which category — drives both partner-facing
-- "what can I set on this listing" and GET /search/filters' derived
-- visibility (no separate bookkeeping table for the latter).
CREATE TABLE IF NOT EXISTS category_attributes (
  category_id BIGINT UNSIGNED NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (category_id, attribute_definition_id),
  CONSTRAINT fk_category_attributes_category FOREIGN KEY (category_id) REFERENCES listing_categories (id),
  CONSTRAINT fk_category_attributes_definition FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id),
  KEY idx_category_attributes_definition_id (attribute_definition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Typed value storage — one table per primitive shape, so a range query
-- (e.g. "bedrooms >= 2") is a real indexed numeric comparison, never a
-- cast off an untyped string column.
CREATE TABLE IF NOT EXISTS listing_attribute_values_integer (
  listing_id BIGINT UNSIGNED NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  value INT NOT NULL,
  PRIMARY KEY (listing_id, attribute_definition_id),
  CONSTRAINT fk_lavi_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_lavi_definition FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id),
  KEY idx_lavi_definition_value (attribute_definition_id, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_attribute_values_decimal (
  listing_id BIGINT UNSIGNED NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  value DECIMAL(18,4) NOT NULL,
  PRIMARY KEY (listing_id, attribute_definition_id),
  CONSTRAINT fk_lavd_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_lavd_definition FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id),
  KEY idx_lavd_definition_value (attribute_definition_id, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_attribute_values_boolean (
  listing_id BIGINT UNSIGNED NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  value TINYINT(1) NOT NULL,
  PRIMARY KEY (listing_id, attribute_definition_id),
  CONSTRAINT fk_lavb_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_lavb_definition FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id),
  KEY idx_lavb_definition_value (attribute_definition_id, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_attribute_values_string (
  listing_id BIGINT UNSIGNED NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  value VARCHAR(255) NOT NULL,
  PRIMARY KEY (listing_id, attribute_definition_id),
  CONSTRAINT fk_lavs_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_lavs_definition FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_attribute_values_date (
  listing_id BIGINT UNSIGNED NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NOT NULL,
  value DATE NOT NULL,
  PRIMARY KEY (listing_id, attribute_definition_id),
  CONSTRAINT fk_lavdt_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_lavdt_definition FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ENUM/MULTI_ENUM value storage — many-to-many, multi-valued for free
-- (a listing can hold several `attribute_options` for the same
-- multi-valued attribute, e.g. several cuisines).
CREATE TABLE IF NOT EXISTS listing_attribute_option (
  listing_id BIGINT UNSIGNED NOT NULL,
  attribute_option_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (listing_id, attribute_option_id),
  CONSTRAINT fk_lao_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_lao_option FOREIGN KEY (attribute_option_id) REFERENCES attribute_options (id),
  KEY idx_lao_option_id (attribute_option_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Amenity scoping (activates the existing, previously-unused
-- listing_amenities/listing_amenity_listing tables from migration 0004/5)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS amenity_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_amenity_groups_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE listing_amenities
  ADD COLUMN amenity_group_id BIGINT UNSIGNED NULL AFTER icon_media_id,
  ADD CONSTRAINT fk_listing_amenities_group_id FOREIGN KEY (amenity_group_id) REFERENCES amenity_groups (id);

CREATE TABLE IF NOT EXISTS amenity_category_applicability (
  amenity_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (amenity_id, category_id),
  CONSTRAINT fk_amenity_cat_appl_amenity FOREIGN KEY (amenity_id) REFERENCES listing_amenities (id),
  CONSTRAINT fk_amenity_cat_appl_category FOREIGN KEY (category_id) REFERENCES listing_categories (id),
  KEY idx_amenity_cat_appl_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Filter metadata (what GET /search/filters serves; §4 of the proposal)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS filter_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_filter_groups_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS filter_group_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  filter_group_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_filter_group_translations_group_id_language_id UNIQUE (filter_group_id, language_id),
  CONSTRAINT fk_filter_group_translations_group_id FOREIGN KEY (filter_group_id) REFERENCES filter_groups (id),
  CONSTRAINT fk_filter_group_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS filter_input_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,   -- RANGE | MULTI_SELECT | SINGLE_SELECT | TOGGLE | STEPPER
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_filter_input_types_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS filter_definitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  filter_group_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  input_type_id BIGINT UNSIGNED NOT NULL,
  value_source ENUM('STATIC','AMENITY','ATTRIBUTE','COMPUTED') NOT NULL,
  attribute_definition_id BIGINT UNSIGNED NULL,
  unit VARCHAR(20) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_advanced TINYINT(1) NOT NULL DEFAULT 0,
  is_global TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_filter_definitions_code UNIQUE (code),
  CONSTRAINT fk_filter_definitions_group FOREIGN KEY (filter_group_id) REFERENCES filter_groups (id),
  CONSTRAINT fk_filter_definitions_input_type FOREIGN KEY (input_type_id) REFERENCES filter_input_types (id),
  CONSTRAINT fk_filter_definitions_attribute FOREIGN KEY (attribute_definition_id) REFERENCES attribute_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS filter_definition_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  filter_definition_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_filter_definition_translations_definition_id_language_id UNIQUE (filter_definition_id, language_id),
  CONSTRAINT fk_filter_definition_translations_definition_id FOREIGN KEY (filter_definition_id) REFERENCES filter_definitions (id),
  CONSTRAINT fk_filter_definition_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
