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
});
