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

function countPlaceholders(sql) {
  return (sql.match(/\?/g) ?? []).length;
}

const baseFilters = { localeId: 1, defaultLocaleId: 1 };

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
        availabilityLastNight: '2026-09-10',
        availabilityQuantity: 2,
      },
      resolveSortOption('newest'),
    );
    expect(sql).toContain('WITH RECURSIVE availability_search_dates');
    expect(sql).toContain('bookable_units');
    expect(sql).toContain('blackout_dates');
    expect(countPlaceholders(sql)).toBe(params.length);
    // CTE's (dateFrom, lastNight) bind first, then localeId/defaultLocaleId,
    // then the capacity EXISTS's quantity, then the blackout NOT EXISTS's
    // (lastNight, dateFrom), then LIMIT.
    expect(params).toEqual([
      '2026-09-10',
      '2026-09-10',
      1,
      1,
      2,
      '2026-09-10',
      '2026-09-10',
      21,
    ]);
  });

  test('availability filter (multi-night stay request) uses distinct dateFrom/lastNight', () => {
    const { sql, params } = buildSearchListingsQuery(
      {
        ...baseFilters,
        availabilityDateFrom: '2026-09-10',
        availabilityLastNight: '2026-09-12',
        availabilityQuantity: 1,
      },
      resolveSortOption('newest'),
    );
    expect(countPlaceholders(sql)).toBe(params.length);
    expect(params).toEqual([
      '2026-09-10',
      '2026-09-12',
      1,
      1,
      1,
      '2026-09-12',
      '2026-09-10',
      21,
    ]);
  });

  test('no availability filter when dates are absent: no CTE emitted', () => {
    const { sql, params } = buildSearchListingsQuery(
      baseFilters,
      resolveSortOption('newest'),
    );
    expect(sql).not.toContain('WITH RECURSIVE');
    expect(sql).not.toContain('bookable_units');
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
        availabilityLastNight: '2026-09-12',
        availabilityQuantity: 2,
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
