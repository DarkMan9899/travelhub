-- Reference & localization data.
-- DATABASE_ARCHITECTURE.md §4.2 + Sprint 5 §6 (Location and Taxonomy Foundation).
--
-- Conventions used throughout every migration in this project (see
-- docs/SPRINT_5_DATABASE_FOUNDATION.md for the full rationale):
--   * snake_case, plural table names, BIGINT UNSIGNED surrogate PK (§2.1)
--   * no native ENUM — fixed vocabularies are lookup tables with a `code`
--     natural key, so a new value is a data insert, not a migration
--   * DATETIME (never TIMESTAMP) for all timestamps, always written/read
--     as UTC by the application layer — DATETIME has no implicit
--     timezone conversion, so this is the "timezone-safe" strategy
--   * lookup/reference tables (this file) carry created_at/updated_at
--     only — no soft-delete, no created_by/updated_by/deleted_by, since
--     they are seeded platform data, not user-authored business records
--     (DATABASE_ARCHITECTURE.md §7 scopes soft-delete to "every primary
--     business entity", not static reference data)

CREATE TABLE IF NOT EXISTS languages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_languages_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS currencies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code CHAR(3) NOT NULL COMMENT 'ISO 4217',
  symbol VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  decimal_places TINYINT UNSIGNED NOT NULL DEFAULT 2,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_currencies_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Daily FX snapshot for *display* conversion only — never used to
-- recompute a historical booking/advertisement price (those always store
-- their own price_snapshot, per DATABASE_ARCHITECTURE.md §11's "fully
-- traceable, never recomputed retroactively" rule). Base currency is AMD
-- (the platform's home currency, Armenia being the initial seed market);
-- rate_to_base = amount of AMD equal to 1 unit of currency_id.
CREATE TABLE IF NOT EXISTS exchange_rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  currency_id BIGINT UNSIGNED NOT NULL,
  rate_to_base DECIMAL(18,8) NOT NULL,
  rate_date DATE NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_exchange_rates_currency_id_rate_date UNIQUE (currency_id, rate_date),
  CONSTRAINT fk_exchange_rates_currency_id FOREIGN KEY (currency_id) REFERENCES currencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS countries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  iso_code CHAR(2) NOT NULL COMMENT 'ISO 3166-1 alpha-2',
  name VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_countries_iso_code UNIQUE (iso_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS country_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  country_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_country_translations_country_id_language_id UNIQUE (country_id, language_id),
  CONSTRAINT fk_country_translations_country_id FOREIGN KEY (country_id) REFERENCES countries (id),
  CONSTRAINT fk_country_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS regions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  country_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_regions_country_id_name UNIQUE (country_id, name),
  CONSTRAINT fk_regions_country_id FOREIGN KEY (country_id) REFERENCES countries (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS region_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  region_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_region_translations_region_id_language_id UNIQUE (region_id, language_id),
  CONSTRAINT fk_region_translations_region_id FOREIGN KEY (region_id) REFERENCES regions (id),
  CONSTRAINT fk_region_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  region_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_cities_slug UNIQUE (slug),
  CONSTRAINT fk_cities_region_id FOREIGN KEY (region_id) REFERENCES regions (id),
  KEY idx_cities_region_id (region_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS city_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  city_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_city_translations_city_id_language_id UNIQUE (city_id, language_id),
  CONSTRAINT fk_city_translations_city_id FOREIGN KEY (city_id) REFERENCES cities (id),
  CONSTRAINT fk_city_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
