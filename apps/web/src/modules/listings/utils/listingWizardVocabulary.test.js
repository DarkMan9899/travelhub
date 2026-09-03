import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guards the exact gap the 2026 stabilization audit found: `MetadataValueDisplay.jsx`,
 * `ListingAttributesSection.jsx`, `ListingPoliciesSection.jsx`, and
 * `ListingAmenitiesSection.jsx` all resolve a controlled-vocabulary code
 * (an attribute/policy code, an ENUM option, an amenity group) through
 * `t('partner.listingWizard.<namespace>.<code>', { defaultValue: code })`.
 * That `defaultValue` fallback means a code with no matching translation
 * key doesn't error or show a placeholder — it silently renders the raw
 * backend code (e.g. `fuel_type`, `DIESEL`) as if it were the label,
 * which on an Armenian or Russian page reads as stray English mixed into
 * the copy. Ten attribute labels, one full attribute (`fuel_type`) plus
 * six others' ENUM options, and four attribute units were missing from
 * all three locale files this way before this audit.
 *
 * These code lists mirror `attribute_definitions`/`attribute_options`/
 * `policy_definitions`/`policy_options`/`amenity_groups` in
 * travelhub_dev as of this audit (2026-09) — kept by hand since the
 * frontend has no build-time link to the database schema. If a future
 * migration adds a new attribute/policy/option/amenity group, add its
 * code here too; that's what turns "someone forgot the translation" into
 * a failing test instead of a silent raw-code leak in production.
 */

const LOCALES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../public/locales',
);

const ATTRIBUTE_CODES = [
  'bathrooms',
  'bedrooms',
  'beds',
  'cuisine',
  'difficulty',
  'doors',
  'duration_minutes',
  'floor_area_sqm',
  'fuel_type',
  'languages_offered',
  'luggage_capacity',
  'max_group_size',
  'max_guests',
  'meeting_point_type',
  'mileage_policy',
  'min_driver_age',
  'price_tier',
  'property_style',
  'seats',
  'star_rating',
  'total_rooms',
  'transmission',
  'view_type',
];

const POLICY_CODES = [
  'cancellation_policy',
  'check_in_time',
  'check_out_time',
  'children_allowed',
  'pets_allowed',
  'smoking_allowed',
];

const AMENITY_GROUP_CODES = [
  'ACCESSIBILITY_SAFETY',
  'CONNECTIVITY',
  'DINING',
  'FAMILY_PETS',
  'FOOD_SERVICE',
  'KITCHEN_LAUNDRY',
  'OUTDOOR',
  'WELLNESS',
];

// unit -> whether this attribute's `data_type` is numeric with a `unit`
// column set (only those actually reach `formatMetadataValue`'s
// `t('partner.listingWizard.units.<unit>', ...)` call).
const NUMERIC_UNITS = [
  'rooms',
  'beds',
  'minutes',
  'sqm',
  'bags',
  'people',
  'guests',
  'years',
  'doors',
  'seats',
];

const ENUM_OPTIONS_BY_ATTRIBUTE = {
  cuisine: [
    'ARMENIAN',
    'ASIAN',
    'EUROPEAN',
    'GEORGIAN',
    'ITALIAN',
    'MEDITERRANEAN',
  ],
  difficulty: ['EASY', 'MODERATE', 'CHALLENGING'],
  fuel_type: ['DIESEL', 'ELECTRIC', 'HYBRID', 'PETROL'],
  languages_offered: ['EN', 'HY', 'RU'],
  meeting_point_type: ['FIXED_LOCATION', 'HOTEL_PICKUP'],
  mileage_policy: ['LIMITED', 'UNLIMITED'],
  price_tier: ['$', '$$', '$$$', '$$$$'],
  property_style: ['BOUTIQUE', 'BUDGET', 'BUSINESS', 'RESORT'],
  star_rating: ['1', '2', '3', '4', '5'],
  transmission: ['AUTOMATIC', 'MANUAL'],
  view_type: ['CITY', 'GARDEN', 'MOUNTAIN', 'NONE', 'SEA'],
};

const ENUM_OPTIONS_BY_POLICY = {
  cancellation_policy: ['FLEXIBLE', 'MODERATE', 'STRICT'],
};

function loadLocale(locale) {
  const raw = fs.readFileSync(
    path.join(LOCALES_DIR, locale, 'common.json'),
    'utf8',
  );
  return JSON.parse(raw);
}

function get(obj, dottedPath) {
  return dottedPath
    .split('.')
    .reduce(
      (node, key) => (node && typeof node === 'object' ? node[key] : undefined),
      obj,
    );
}

describe.each(['en', 'hy', 'ru'])(
  'listing wizard controlled-vocabulary translation coverage (%s)',
  (locale) => {
    const data = loadLocale(locale);

    test.each(ATTRIBUTE_CODES)('attribute "%s" has a label', (code) => {
      expect(get(data, `partner.listingWizard.attributes.${code}`)).toEqual(
        expect.any(String),
      );
    });

    test.each(POLICY_CODES)('policy "%s" has a label', (code) => {
      expect(get(data, `partner.listingWizard.policies.${code}`)).toEqual(
        expect.any(String),
      );
    });

    test.each(AMENITY_GROUP_CODES)('amenity group "%s" has a label', (code) => {
      expect(get(data, `partner.listingWizard.amenityGroups.${code}`)).toEqual(
        expect.any(String),
      );
    });

    test.each(NUMERIC_UNITS)('unit "%s" has a translation', (unit) => {
      expect(get(data, `partner.listingWizard.units.${unit}`)).toEqual(
        expect.any(String),
      );
    });

    test.each(
      Object.entries(ENUM_OPTIONS_BY_ATTRIBUTE).flatMap(([attr, options]) =>
        options.map((option) => [attr, option]),
      ),
    )('attribute option "%s.%s" has a label', (attr, option) => {
      expect(
        get(data, `partner.listingWizard.options.${attr}.${option}`),
      ).toEqual(expect.any(String));
    });

    test.each(
      Object.entries(ENUM_OPTIONS_BY_POLICY).flatMap(([policy, options]) =>
        options.map((option) => [policy, option]),
      ),
    )('policy option "%s.%s" has a label', (policy, option) => {
      expect(
        get(data, `partner.listingWizard.options.${policy}.${option}`),
      ).toEqual(expect.any(String));
    });
  },
);
