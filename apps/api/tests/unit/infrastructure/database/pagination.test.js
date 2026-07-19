/**
 * Sprint 5 §3: "pagination conventions." Validates the cursor
 * encode/decode round-trip and the has_more/limit page-shaping logic
 * against API_SPECIFICATION.md §8's meta envelope.
 */

import { describe, test, expect } from '@jest/globals';
import {
  encodeCursor,
  decodeCursor,
  resolveLimit,
  buildPageMeta,
} from '../../../../src/infrastructure/database/pagination.js';

describe('Pagination helper (src/infrastructure/database/pagination.js)', () => {
  test('encodeCursor/decodeCursor round-trip an arbitrary sort-key value', () => {
    const value = { id: 42, createdAt: '2024-01-01T00:00:00.000Z' };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  test('decodeCursor treats a missing cursor as "start from the top"', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  test('decodeCursor treats a tampered/malformed cursor as null, never throws', () => {
    expect(() => decodeCursor('not-valid-base64url-json')).not.toThrow();
    expect(decodeCursor('not-valid-base64url-json')).toBeNull();
  });

  test('resolveLimit falls back to the default for a missing/invalid value', () => {
    expect(resolveLimit(undefined)).toBe(20);
    expect(resolveLimit('not-a-number')).toBe(20);
    expect(resolveLimit(-5)).toBe(20);
    expect(resolveLimit(0)).toBe(20);
  });

  test('resolveLimit caps at maxLimit', () => {
    expect(resolveLimit(9999)).toBe(100);
  });

  test('resolveLimit accepts a valid requested limit', () => {
    expect(resolveLimit(10)).toBe(10);
  });

  test('buildPageMeta reports has_more=false when fewer rows than limit+1 were fetched', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const { rows: pageRows, meta } = buildPageMeta(rows, 20, (row) => row.id);
    expect(pageRows).toHaveLength(2);
    expect(meta.has_more).toBe(false);
    expect(meta.next_cursor).toBeNull();
    expect(meta.limit).toBe(20);
  });

  test('buildPageMeta strips the over-fetched row and reports has_more=true', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]; // limit=2, fetched 3
    const { rows: pageRows, meta } = buildPageMeta(rows, 2, (row) => row.id);
    expect(pageRows).toHaveLength(2);
    expect(meta.has_more).toBe(true);
    expect(decodeCursor(meta.next_cursor)).toBe(2); // cursor points at the last row of the *returned* page
  });
});
