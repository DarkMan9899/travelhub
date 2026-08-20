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

    test('is unaffected by a truly unrelated/stale param name', () => {
      const params = new URLSearchParams(
        'destination=dilijan&checkIn=2026-08-01&checkOut=2026-08-05',
      );
      const result = parseSearchParams(params);
      expect(result.destination).toBe('dilijan');
      expect(result.dateFrom).toBeUndefined();
      expect(result.dateTo).toBeUndefined();
    });

    test('(P1.1) reads a valid dateFrom/dateTo pair', () => {
      const params = new URLSearchParams(
        'dateFrom=2026-08-01&dateTo=2026-08-05',
      );
      const result = parseSearchParams(params);
      expect(result.dateFrom).toBe('2026-08-01');
      expect(result.dateTo).toBe('2026-08-05');
    });

    test('(P1.1) drops dateFrom/dateTo when only one of the pair is present', () => {
      expect(
        parseSearchParams(new URLSearchParams('dateFrom=2026-08-01')).dateFrom,
      ).toBeUndefined();
      expect(
        parseSearchParams(new URLSearchParams('dateTo=2026-08-05')).dateTo,
      ).toBeUndefined();
    });

    test('(P1.1) drops a malformed date pair rather than sending garbage upstream', () => {
      const result = parseSearchParams(
        new URLSearchParams('dateFrom=not-a-date&dateTo=2026-08-05'),
      );
      expect(result.dateFrom).toBeUndefined();
      expect(result.dateTo).toBeUndefined();
    });

    test('(P1.1) drops an inverted date range (dateTo before dateFrom)', () => {
      const result = parseSearchParams(
        new URLSearchParams('dateFrom=2026-08-05&dateTo=2026-08-01'),
      );
      expect(result.dateFrom).toBeUndefined();
      expect(result.dateTo).toBeUndefined();
    });

    test('(P1.1) reads a valid guests count', () => {
      expect(parseSearchParams(new URLSearchParams('guests=4')).guests).toBe(4);
    });

    test('(P1.1) drops an invalid guests value (zero, negative, non-integer, over the max)', () => {
      expect(
        parseSearchParams(new URLSearchParams('guests=0')).guests,
      ).toBeUndefined();
      expect(
        parseSearchParams(new URLSearchParams('guests=-1')).guests,
      ).toBeUndefined();
      expect(
        parseSearchParams(new URLSearchParams('guests=abc')).guests,
      ).toBeUndefined();
      expect(
        parseSearchParams(new URLSearchParams('guests=51')).guests,
      ).toBeUndefined();
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

    test('(P1.1) writes dateFrom/dateTo/guests when set', () => {
      const params = buildSearchParams({
        destination: '',
        sort: 'newest',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-05',
        guests: 3,
      });
      expect(params.get('dateFrom')).toBe('2026-08-01');
      expect(params.get('dateTo')).toBe('2026-08-05');
      expect(params.get('guests')).toBe('3');
    });

    test('(P1.1) never writes a half-formed date pair', () => {
      const params = buildSearchParams({
        destination: '',
        sort: 'newest',
        dateFrom: '2026-08-01',
      });
      expect(params.has('dateFrom')).toBe(false);
      expect(params.has('dateTo')).toBe(false);
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

    test('(P1.1) includes dateFrom/dateTo/guests using the same key names the backend expects', () => {
      const query = toSearchQueryParams(
        {
          destination: 'yerevan',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-05',
          guests: 2,
        },
        'en',
      );
      expect(query).toEqual({
        keyword: 'yerevan',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-05',
        guests: 2,
        locale: 'en',
      });
    });

    test('(P1.1) never sends a half-formed date pair upstream', () => {
      const query = toSearchQueryParams(
        { destination: 'yerevan', dateFrom: '2026-08-01' },
        undefined,
      );
      expect(query).not.toHaveProperty('dateFrom');
      expect(query).not.toHaveProperty('dateTo');
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
