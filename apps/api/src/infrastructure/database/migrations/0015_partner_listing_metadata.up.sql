-- Phase 5: Partner Listing Creation — pricing, policies, and booking-rules
-- metadata (docs/plan: "Phase 5 — Partner Listing Creation"). Purely
-- additive — no table from migration 0014 (the Generic Attribute Engine /
-- Dynamic Filter System) is altered here.
--
-- Design summary:
--   * `pricing_models` + `category_pricing_models` mirror `attribute_
--     definitions` + `category_attributes`' exact shape (a lookup +ma
--     category-scoping mapping table) so "which pricing models apply to
--     category X" is discoverable the same way "which attributes apply to
--     category X" already is — no per-category hardcoding in the frontend.
--   * `policy_definitions` + `category_policies` + `policy_options` mirror
--     `attribute_definitions` + `category_attributes` + `attribute_options`
--     for the exact same reason. `policy_definitions.data_type_id`
--     references the EXISTING `attribute_data_types` lookup (read-only
--     reuse, not a modification) rather than inventing a parallel one.
--   * `listing_policy_values` is deliberately a single flexible VARCHAR
--     column, not 5 typed tables like `listing_attribute_values_*` —
--     policies are never filtered/range-queried by search (the entire
--     reason the Attribute Engine went typed), so that complexity isn't
--     justified here.
--   * `listing_booking_rules` is a 1:1 sidecar on `listings` for the three
--     rule types the phase brief asks for that don't exist anywhere yet
--     (minimum/maximum stay, advance-booking window) — additive, doesn't
--     touch `bookable_units`/`availability_calendar`.

-- ---------------------------------------------------------------------
-- Pricing
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pricing_models (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,   -- PER_NIGHT | PER_PERSON | PER_DAY | PER_HOUR
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_pricing_models_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which pricing models a category may offer (mirrors category_attributes).
CREATE TABLE IF NOT EXISTS category_pricing_models (
  category_id BIGINT UNSIGNED NOT NULL,
  pricing_model_id BIGINT UNSIGNED NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (category_id, pricing_model_id),
  CONSTRAINT fk_category_pricing_models_category FOREIGN KEY (category_id) REFERENCES listing_categories (id),
  CONSTRAINT fk_category_pricing_models_model FOREIGN KEY (pricing_model_id) REFERENCES pricing_models (id),
  KEY idx_category_pricing_models_model_id (pricing_model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One base price per listing (today's scope: a single flat rate, not the
-- full seasonal/date-ranged rate-plan system API_SPECIFICATION.md §51
-- documents as a separate future Pricing module).
CREATE TABLE IF NOT EXISTS listing_pricing (
  listing_id BIGINT UNSIGNED NOT NULL,
  pricing_model_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (listing_id),
  CONSTRAINT fk_listing_pricing_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_pricing_model FOREIGN KEY (pricing_model_id) REFERENCES pricing_models (id),
  CONSTRAINT fk_listing_pricing_currency FOREIGN KEY (currency_id) REFERENCES currencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS policy_definitions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(60) NOT NULL,
  data_type_id BIGINT UNSIGNED NOT NULL,
  unit VARCHAR(20) NULL,
  is_multi_valued TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_policy_definitions_code UNIQUE (code),
  -- Reuses the EXISTING attribute_data_types lookup (migration 0014) —
  -- read-only reuse of a shared vocabulary (BOOLEAN/ENUM/STRING/...), not a
  -- modification of the Generic Attribute Engine itself.
  CONSTRAINT fk_policy_definitions_data_type FOREIGN KEY (data_type_id) REFERENCES attribute_data_types (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS policy_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  policy_definition_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(60) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_policy_options_definition_id_code UNIQUE (policy_definition_id, code),
  CONSTRAINT fk_policy_options_definition_id FOREIGN KEY (policy_definition_id) REFERENCES policy_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which policies apply to which category (mirrors category_attributes,
-- including the same is_required/sort_order shape).
CREATE TABLE IF NOT EXISTS category_policies (
  category_id BIGINT UNSIGNED NOT NULL,
  policy_definition_id BIGINT UNSIGNED NOT NULL,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (category_id, policy_definition_id),
  CONSTRAINT fk_category_policies_category FOREIGN KEY (category_id) REFERENCES listing_categories (id),
  CONSTRAINT fk_category_policies_definition FOREIGN KEY (policy_definition_id) REFERENCES policy_definitions (id),
  KEY idx_category_policies_definition_id (policy_definition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One flexible string value per (listing, policy) — see file header for why
-- this is intentionally untyped, unlike listing_attribute_values_*.
CREATE TABLE IF NOT EXISTS listing_policy_values (
  listing_id BIGINT UNSIGNED NOT NULL,
  policy_definition_id BIGINT UNSIGNED NOT NULL,
  value VARCHAR(255) NOT NULL,
  PRIMARY KEY (listing_id, policy_definition_id),
  CONSTRAINT fk_listing_policy_values_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
  CONSTRAINT fk_listing_policy_values_definition FOREIGN KEY (policy_definition_id) REFERENCES policy_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Booking rules (minimum/maximum stay, advance-booking window) — a 1:1
-- sidecar on listings, additive to the existing Availability module
-- (bookable_units/availability_calendar stay untouched).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS listing_booking_rules (
  listing_id BIGINT UNSIGNED NOT NULL,
  minimum_stay_nights SMALLINT UNSIGNED NULL,
  maximum_stay_nights SMALLINT UNSIGNED NULL,
  advance_booking_min_hours INT UNSIGNED NULL,
  advance_booking_max_days INT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (listing_id),
  CONSTRAINT fk_listing_booking_rules_listing FOREIGN KEY (listing_id) REFERENCES listings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
