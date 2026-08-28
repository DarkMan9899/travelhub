/**
 * Sprint 8: `buildSearchListingsQuery` is pure (no DB), extracted from
 * `MySqlSearchRepository` specifically so its `?` placeholder/parameter
 * alignment can be verified mechanically — MySQL binds placeholders by
 * their left-to-right physical position in the assembled SQL string, a
 * classic place for an off-by-one/out-of-order bug to hide undetected
 * until a query silently returns wrong rows.
 */

import { describe, test, expect } from '@jest/globals';
import { buildSearchListingsQuery } from '../../../../src/modules/search/repositories/mysqlSearchRepository.js';
import { resolveSortOption } from '../../../../src/core/domain/sortOptions.js';
import { ACCOMMODATION_BOOKABLE_UNIT_TYPES } from '../../../../src/core/domain/accommodationDateSemantics.js';
import { INVENTORY_QUANTITY_BOOKABLE_UNIT_TYPES } from '../../../../src/core/domain/inventoryQuantityUnitTypes.js';

function countPlaceholders(sql) {
  return (sql.match(/\?/g) ?? []).length;
}

const baseFilters = { localeId: 1, defaultLocaleId: 1 };

/** `ACCOMMODATION_BOOKABLE_UNIT_TYPES` bound once per `IN (...)` occurrence in the availability EXISTS block — see `mysqlSearchRepository.js`'s own comment on why this repeats rather than being reused. */
const TYPES = ACCOMMODATION_BOOKABLE_UNIT_TYPES;
/** Launch-blocker remediation (P0-C): the quantity IF's own IN(...) is gated by this separate, VEHICLE-inclusive list instead of `TYPES` above. */
const INVENTORY_TYPES = INVENTORY_QUANTITY_BOOKABLE_UNIT_TYPES;

describe('buildSearchListingsQuery — placeholder/parameter alignment', () => {
  test('no filters, no keyword: placeholder count matches params length', () => {
    const { sql, params } = buildSearchListingsQuery(
      baseFilters,
      resolveSortOption('newest'),
    );
    expect(countPlaceholders(sql)).toBe(params.length);
  });

  test('every optional filter set simultaneously (no keyword)', () => {
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        categoryId: 5,
        listingTypeCode: 'HOTEL',
        cityId: 10,
        countryId: 2,
        partnerId: 7,
        statusCode: 'PUBLISHED',
      },
      resolveSortOption('oldest'),
    );
    expect(countPlaceholders(sql)).toBe(params.length);
  });

  test('keyword present: placeholder count still matches params length', () => {
    const { sql, params } = buildSearchListingsQuery(
      { ...baseFilters, keyword: 'hotel yerevan' },
      resolveSortOption('relevance', { hasKeyword: true }),
    );
    expect(countPlaceholders(sql)).toBe(params.length);
  });

  test('keyword + every filter + cursor: placeholder count still matches params length', () => {
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        keyword: 'boutique',
        categoryId: 5,
        listingTypeCode: 'HOTEL',
        cityId: 10,
        countryId: 2,
        partnerId: 7,
        statusCode: 'DRAFT',
      },
      resolveSortOption('relevance', { hasKeyword: true }),
      { cursor: 'eyJzb3J0VmFsdWUiOjAuNSwiaWQiOjR9', limit: 10 },
    );
    expect(countPlaceholders(sql)).toBe(params.length);
  });

  test('onlyPublished (no explicit statusCode) still balances', () => {
    const { sql, params } = buildSearchListingsQuery(
      { ...baseFilters, onlyPublished: true },
      resolveSortOption('alphabetical'),
    );
    expect(countPlaceholders(sql)).toBe(params.length);
  });

  test('exact param order for a representative keyword + filter query matches the physical placeholder order', () => {
    const { params } = buildSearchListingsQuery(
      {
        localeId: 3,
        defaultLocaleId: 1,
        keyword: 'spa',
        partnerId: 42,
        onlyPublished: true,
      },
      resolveSortOption('relevance', { hasKeyword: true }),
      { limit: 5 },
    );

    // Physical order in the SQL: SELECT's MATCH keyword, then JOIN
    // lt.language_id, JOIN lt2.language_id, then WHERE's partner_id,
    // then WHERE's MATCH keyword (again, for the `> 0` filter), then
    // LIMIT's (limit + 1).
    expect(params).toEqual(['spa', 3, 1, 42, 'spa', 6]);
  });

  test('a cursor contributes exactly two trailing params (sortValue, id) before LIMIT', () => {
    const cursor = Buffer.from(
      JSON.stringify({ sortValue: 'Alpha Hotel', id: 9 }),
      'utf8',
    ).toString('base64url');
    const { params } = buildSearchListingsQuery(
      { localeId: 1, defaultLocaleId: 1 },
      resolveSortOption('alphabetical'),
      { cursor, limit: 20 },
    );
    // localeId, defaultLocaleId, then cursor's (sortValue, id), then limit+1.
    expect(params).toEqual([1, 1, 'Alpha Hotel', 9, 21]);
  });

  test('amenityIds: one EXISTS placeholder per id, balances with params', () => {
    const { sql, params } = buildSearchListingsQuery(
      { ...baseFilters, amenityIds: [3, 9, 14] },
      resolveSortOption('newest'),
    );
    expect(countPlaceholders(sql)).toBe(params.length);
    expect(params).toEqual([1, 1, 3, 9, 14, 21]);
  });

  test('attributeFilters: ENUM optionIds expand to one IN(...) placeholder each', () => {
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        attributeFilters: [
          {
            attributeDefinitionId: 5,
            dataTypeCode: 'ENUM',
            optionIds: [16, 17],
          },
        ],
      },
      resolveSortOption('newest'),
    );
    expect(countPlaceholders(sql)).toBe(params.length);
    expect(params).toEqual([1, 1, 16, 17, 21]);
  });

  test('attributeFilters: numeric min/max against a typed value table', () => {
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        attributeFilters: [
          { attributeDefinitionId: 1, dataTypeCode: 'INTEGER', min: 2 },
          {
            attributeDefinitionId: 8,
            dataTypeCode: 'INTEGER',
            min: 30,
            max: 120,
          },
        ],
      },
      resolveSortOption('newest'),
    );
    expect(sql).toContain('listing_attribute_values_integer');
    expect(countPlaceholders(sql)).toBe(params.length);
    expect(params).toEqual([1, 1, 1, 2, 8, 30, 120, 21]);
  });

  test('availability filter (single-day request): CTE params bind first, condition params balance', () => {
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        availabilityDateFrom: '2026-09-10',
        availabilityDateTo: '2026-09-10',
        availabilityLastNight: '2026-09-10',
        availabilityGuests: 2,
      },
      resolveSortOption('newest'),
    );
    expect(sql).toContain('WITH RECURSIVE availability_search_dates');
    expect(sql).toContain('bookable_units');
    expect(sql).toContain('bookable_unit_types');
    expect(sql).toContain('blackout_dates');
    expect(countPlaceholders(sql)).toBe(params.length);
    // CTE's (dateFrom, dateTo) bind first, then localeId/defaultLocaleId,
    // then the single EXISTS-over-bu block's four placeholder groups in
    // physical order: max_guests's IN(...) + bound, the date IF's IN(...)
    // + (lastNight, dateTo), the quantity IF's IN(...) + (requestedQty,
    // guests), the blackout IF's IN(...) + (lastNight, dateTo), then the
    // blackout's own dateFrom bound, then LIMIT.
    expect(params).toEqual([
      '2026-09-10',
      '2026-09-10',
      1,
      1,
      ...TYPES,
      2,
      ...TYPES,
      '2026-09-10',
      '2026-09-10',
      ...INVENTORY_TYPES,
      1,
      2,
      ...TYPES,
      '2026-09-10',
      '2026-09-10',
      '2026-09-10',
      21,
    ]);
  });

  test('availability filter joins bookable_unit_types, gates the date bound by accommodation type, and gates the quantity bound by the separate (accommodation + VEHICLE) inventory-quantity type list (P2.2D / P0-C launch-blocker remediation)', () => {
    const { sql } = buildSearchListingsQuery(
      {
        ...baseFilters,
        availabilityDateFrom: '2026-09-10',
        availabilityDateTo: '2026-09-12',
        availabilityLastNight: '2026-09-11',
        availabilityGuests: 2,
      },
      resolveSortOption('newest'),
    );
    const typePlaceholders = TYPES.map(() => '?').join(', ');
    const inventoryTypePlaceholders = INVENTORY_TYPES.map(() => '?').join(', ');
    expect(sql).toContain(
      'JOIN bookable_unit_types but ON but.id = bu.bookable_unit_type_id',
    );
    expect(sql).toContain('bu.max_guests IS NULL');
    expect(sql).toContain(
      `sd.d <= IF(but.code IN (${typePlaceholders}), ?, ?)`,
    );
    // The quantity bound uses a DIFFERENT, VEHICLE-inclusive type list —
    // deliberately not the same `typePlaceholders` as the date bound
    // above (VEHICLE's date semantics stay unchanged).
    expect(sql).toContain(
      `< IF(but.code IN (${inventoryTypePlaceholders}), ?, ?)`,
    );
    expect(sql).not.toContain(`< IF(but.code IN (${typePlaceholders}), ?, ?)`);
  });

  test('availability filter (multi-night stay request) uses distinct dateFrom/lastNight for the checkout-exclusive branch', () => {
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        availabilityDateFrom: '2026-09-10',
        availabilityDateTo: '2026-09-12',
        availabilityLastNight: '2026-09-11',
        availabilityGuests: 1,
      },
      resolveSortOption('newest'),
    );
    expect(countPlaceholders(sql)).toBe(params.length);
    expect(params).toEqual([
      '2026-09-10',
      '2026-09-12',
      1,
      1,
      ...TYPES,
      1,
      ...TYPES,
      '2026-09-11',
      '2026-09-12',
      ...INVENTORY_TYPES,
      1,
      1,
      ...TYPES,
      '2026-09-11',
      '2026-09-12',
      '2026-09-10',
      21,
    ]);
  });

  test('no availability filter when dates are absent: no CTE/date-aware EXISTS emitted', () => {
    const { sql, params } = buildSearchListingsQuery(
      baseFilters,
      resolveSortOption('newest'),
    );
    expect(sql).not.toContain('WITH RECURSIVE');
    expect(sql).not.toContain('bookable_unit_types');
    expect(sql).not.toContain('blackout_dates');
    // The P2.2D "from" price aggregation always references
    // `bookable_units` (unconditionally, unlike the availability filter),
    // so this file's presence check moved from the table name itself to
    // the availability-specific `bookable_unit_types` join alias above.
    expect(sql).toContain('bookable_units');
    expect(countPlaceholders(sql)).toBe(params.length);
  });

  test('availability filter combined with amenityIds + attributeFilters + keyword + cursor still balances', () => {
    const cursor = Buffer.from(
      JSON.stringify({ sortValue: 0.5, id: 4 }),
      'utf8',
    ).toString('base64url');
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        keyword: 'spa',
        amenityIds: [3],
        attributeFilters: [
          { attributeDefinitionId: 5, dataTypeCode: 'ENUM', optionIds: [16] },
        ],
        availabilityDateFrom: '2026-09-10',
        availabilityDateTo: '2026-09-12',
        availabilityLastNight: '2026-09-11',
        availabilityGuests: 2,
      },
      resolveSortOption('relevance', { hasKeyword: true }),
      { cursor, limit: 10 },
    );
    expect(countPlaceholders(sql)).toBe(params.length);
    expect(params[0]).toBe('2026-09-10');
    expect(params[1]).toBe('2026-09-12');
  });

  test('amenityIds + attributeFilters + keyword + cursor all combined still balance', () => {
    const cursor = Buffer.from(
      JSON.stringify({ sortValue: 0.5, id: 4 }),
      'utf8',
    ).toString('base64url');
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        keyword: 'spa',
        amenityIds: [3],
        attributeFilters: [
          { attributeDefinitionId: 5, dataTypeCode: 'ENUM', optionIds: [16] },
        ],
      },
      resolveSortOption('relevance', { hasKeyword: true }),
      { cursor, limit: 10 },
    );
    expect(countPlaceholders(sql)).toBe(params.length);
  });
});
