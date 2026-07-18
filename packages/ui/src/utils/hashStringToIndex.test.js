import { describe, test, expect } from 'vitest';
import hashStringToIndex from './hashStringToIndex.js';

describe('hashStringToIndex', () => {
  test('is deterministic: the same input always maps to the same index', () => {
    const first = hashStringToIndex('user-42', 7);
    const second = hashStringToIndex('user-42', 7);
    expect(first).toBe(second);
  });

  test('always returns an index within [0, paletteSize)', () => {
    ['', 'a', 'user-1', 'a-much-longer-user-identifier-string'].forEach(
      (value) => {
        const index = hashStringToIndex(value, 5);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(5);
      },
    );
  });

  test('different inputs typically map to different indices', () => {
    const values = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6'];
    const indices = new Set(values.map((value) => hashStringToIndex(value, 7)));
    expect(indices.size).toBeGreaterThan(1);
  });
});
