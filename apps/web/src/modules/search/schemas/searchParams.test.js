import { describe, test, expect } from 'vitest';
import {
  parseSearchParams,
  buildSearchParams,
  toSearchQueryParams,
} from './searchParams.js';

describe('searchParams (apps/web/src/modules/search)', () => {
  describe('parseSearchParams', () => {
    test('defaults to empty destination, no category, and the default sort', () => {
      expect(parseSearchParams(new URLSearchParams())).toEqual({
        destination: '',
        categoryId: undefined,
        sort: 'newest',
        dynamicFilters: {},
      });
    });

    test('reads destination, categoryId, and sort from real params', () => {
      const params = new URLSearchParams(
        'destination=yerevan&categoryId=3&sort=alphabetical',
      );
      expect(parseSearchParams(params)).toEqual({
        destination: 'yerevan',
        categoryId: 3,
        sort: 'alphabetical',
        dynamicFilters: {},
      });
    });

    test('ignores an invalid categoryId rather than throwing', () => {
      const params = new URLSearchParams('categoryId=not-a-number');
      expect(parseSearchParams(params).categoryId).toBeUndefined();
    });

    test('falls back to the default sort for an unknown sort value', () => {
      const params = new URLSearchParams('sort=trending');
      expect(parseSearchParams(params).sort).toBe('newest');
    });

    test("is unaffected by unrelated params (e.g. the Homepage widget's checkIn/checkOut/guests)", () => {
      const params = new URLSearchParams(
        'destination=dilijan&checkIn=2026-08-01&checkOut=2026-08-05&guests=2',
      );
      expect(parseSearchParams(params)).toEqual({
        destination: 'dilijan',
        categoryId: undefined,
        sort: 'newest',
        dynamicFilters: {},
      });
    });

    test('collects any non-fixed, non-empty key into dynamicFilters (Phase 4.2)', () => {
      const params = new URLSearchParams(
        'destination=yerevan&attr_bedrooms_min=2&amenityIds=1,2&attr_empty=',
      );
      expect(parseSearchParams(params).dynamicFilters).toEqual({
        attr_bedrooms_min: '2',
        amenityIds: '1,2',
      });
    });
  });

  describe('buildSearchParams', () => {
    test('omits every key at its default/empty value', () => {
      const params = buildSearchParams({
        destination: '',
        categoryId: undefined,
        sort: 'newest',
      });
      expect(params.toString()).toBe('');
    });

    test('includes only the keys that are actually set', () => {
      const params = buildSearchParams({
        destination: 'yerevan',
        categoryId: 3,
        sort: 'alphabetical',
      });
      expect(params.get('destination')).toBe('yerevan');
      expect(params.get('categoryId')).toBe('3');
      expect(params.get('sort')).toBe('alphabetical');
    });

    test('drops any unrelated param not part of this schema', () => {
      const params = buildSearchParams({
        destination: 'yerevan',
        categoryId: undefined,
        sort: 'newest',
      });
      expect(params.has('checkIn')).toBe(false);
      expect(params.has('guests')).toBe(false);
    });

    test('writes dynamicFilters keys straight through, omitting empty values', () => {
      const params = buildSearchParams({
        destination: '',
        sort: 'newest',
        dynamicFilters: {
          attr_bedrooms_min: '2',
          amenityIds: '',
          attr_star_rating: '5',
        },
      });
      expect(params.get('attr_bedrooms_min')).toBe('2');
      expect(params.get('attr_star_rating')).toBe('5');
      expect(params.has('amenityIds')).toBe(false);
    });
  });

  describe('toSearchQueryParams', () => {
    test('maps destination to the backend\'s real "keyword" param name', () => {
      const query = toSearchQueryParams(
        { destination: 'yerevan', categoryId: 3, sort: 'newest' },
        'en',
      );
      expect(query).toEqual({
        keyword: 'yerevan',
        categoryId: 3,
        sort: 'newest',
        locale: 'en',
      });
    });

    test('omits keys with no value instead of sending empty/undefined', () => {
      const query = toSearchQueryParams(
        { destination: '', categoryId: undefined, sort: 'newest' },
        undefined,
      );
      expect(query).toEqual({ sort: 'newest' });
    });

    test('spreads dynamicFilters directly into the query object', () => {
      const query = toSearchQueryParams(
        {
          destination: '',
          sort: 'newest',
          dynamicFilters: { attr_bedrooms_min: '2', amenityIds: '1,2' },
        },
        undefined,
      );
      expect(query).toEqual({
        sort: 'newest',
        attr_bedrooms_min: '2',
        amenityIds: '1,2',
      });
    });
  });
});
