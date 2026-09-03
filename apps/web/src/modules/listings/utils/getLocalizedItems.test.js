import { describe, test, expect } from 'vitest';
import getLocalizedItems, {
  getLocalizedItemsExact,
} from './getLocalizedItems.js';

const ITEMS = [
  { id: 1, language_code: 'en', text: 'EN one' },
  { id: 2, language_code: 'en', text: 'EN two' },
  { id: 3, language_code: 'hy', text: 'HY one' },
  { id: 4, language_code: 'ru', text: 'RU one' },
];

describe('getLocalizedItems (apps/web/src/modules/listings)', () => {
  test('returns only the items matching the requested locale', () => {
    expect(getLocalizedItems(ITEMS, 'hy')).toEqual([
      { id: 3, language_code: 'hy', text: 'HY one' },
    ]);
  });

  test('falls back to the default content locale when the requested locale has no items', () => {
    const withoutRu = ITEMS.filter((item) => item.language_code !== 'ru');
    expect(getLocalizedItems(withoutRu, 'ru')).toEqual([
      { id: 1, language_code: 'en', text: 'EN one' },
      { id: 2, language_code: 'en', text: 'EN two' },
    ]);
  });

  test('never mixes two locales into one returned list', () => {
    const result = getLocalizedItems(ITEMS, 'ru');
    const locales = new Set(result.map((item) => item.language_code));
    expect(locales.size).toBe(1);
  });

  test('returns an empty array, never undefined or raw data, when nothing matches at all', () => {
    const hyAndRuOnly = ITEMS.filter((item) => item.language_code !== 'en');
    expect(getLocalizedItems(hyAndRuOnly, 'fr')).toEqual([]);
  });

  test('returns an empty array for a missing or empty items array', () => {
    expect(getLocalizedItems(undefined, 'en')).toEqual([]);
    expect(getLocalizedItems([], 'en')).toEqual([]);
  });

  test('preserves the original relative order within the matched locale', () => {
    const shuffled = [
      { id: 2, language_code: 'en', text: 'second' },
      { id: 1, language_code: 'en', text: 'first' },
    ];
    expect(getLocalizedItems(shuffled, 'en').map((item) => item.text)).toEqual([
      'second',
      'first',
    ]);
  });
});

// 2026 Partner Workspace redesign (Sprint 3): the authoring-UI variant —
// the one behavioral difference from `getLocalizedItems` is the whole
// point of this function existing, so it's the one thing under test.
describe('getLocalizedItemsExact (apps/web/src/modules/listings)', () => {
  test('returns only the items matching the requested locale, same as getLocalizedItems', () => {
    expect(getLocalizedItemsExact(ITEMS, 'hy')).toEqual([
      { id: 3, language_code: 'hy', text: 'HY one' },
    ]);
  });

  test('does NOT fall back to the default content locale — an empty array means genuinely empty', () => {
    const withoutRu = ITEMS.filter((item) => item.language_code !== 'ru');
    expect(getLocalizedItemsExact(withoutRu, 'ru')).toEqual([]);
  });

  test('returns an empty array for a missing or empty items array', () => {
    expect(getLocalizedItemsExact(undefined, 'en')).toEqual([]);
    expect(getLocalizedItemsExact([], 'en')).toEqual([]);
  });
});
