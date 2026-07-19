/**
 * Sprint 8: "Sorting: newest, oldest, alphabetical, relevance (prepare
 * architecture even if initial implementation is simple)."
 */

import { describe, test, expect } from '@jest/globals';
import {
  SORT_KEYS,
  DEFAULT_SORT_KEY,
  resolveSortOption,
} from '../../../../src/core/domain/sortOptions.js';

describe('resolveSortOption', () => {
  test('newest sorts by created_at DESC', () => {
    expect(resolveSortOption('newest')).toEqual({
      key: 'newest',
      column: 'created_at',
      direction: 'DESC',
      requiresKeyword: false,
    });
  });

  test('oldest sorts by created_at ASC', () => {
    expect(resolveSortOption('oldest').direction).toBe('ASC');
    expect(resolveSortOption('oldest').column).toBe('created_at');
  });

  test('alphabetical sorts by title ASC', () => {
    expect(resolveSortOption('alphabetical').column).toBe('title');
    expect(resolveSortOption('alphabetical').direction).toBe('ASC');
  });

  test('relevance is honored when a keyword is present', () => {
    const option = resolveSortOption('relevance', { hasKeyword: true });
    expect(option.key).toBe('relevance');
    expect(option.column).toBe('relevance_score');
  });

  test('relevance falls back to the default sort when no keyword is present', () => {
    const option = resolveSortOption('relevance', { hasKeyword: false });
    expect(option.key).toBe(DEFAULT_SORT_KEY);
  });

  test('relevance with no options argument also falls back (hasKeyword defaults to false)', () => {
    expect(resolveSortOption('relevance').key).toBe(DEFAULT_SORT_KEY);
  });

  test('an unknown sort key throws rather than silently defaulting', () => {
    expect(() => resolveSortOption('popularity')).toThrow(TypeError);
  });

  test('SORT_KEYS exposes exactly the four documented sort options', () => {
    expect([...SORT_KEYS].sort()).toEqual(
      ['newest', 'oldest', 'alphabetical', 'relevance'].sort(),
    );
  });
});
