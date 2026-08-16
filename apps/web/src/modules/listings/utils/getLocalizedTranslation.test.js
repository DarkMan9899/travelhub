import { describe, test, expect } from 'vitest';
import getLocalizedTranslation from './getLocalizedTranslation.js';

const TRANSLATIONS = [
  { language_code: 'en', title: 'Boutique Hotel' },
  { language_code: 'hy', title: 'Բուտիկ հյուրանոց' },
  { language_code: 'ru', title: 'Бутик-отель' },
];

describe('getLocalizedTranslation', () => {
  test('returns the translation matching the requested locale', () => {
    expect(getLocalizedTranslation(TRANSLATIONS, 'hy')).toEqual(
      TRANSLATIONS[1],
    );
  });

  test('falls back to the first translation when no row matches the locale', () => {
    expect(getLocalizedTranslation(TRANSLATIONS, 'fr')).toEqual(
      TRANSLATIONS[0],
    );
  });

  test('falls back to the first translation when no locale is given', () => {
    expect(getLocalizedTranslation(TRANSLATIONS, undefined)).toEqual(
      TRANSLATIONS[0],
    );
  });

  test('returns null for an empty translations array', () => {
    expect(getLocalizedTranslation([], 'en')).toBeNull();
  });

  test('returns null when translations is not an array', () => {
    expect(getLocalizedTranslation(null, 'en')).toBeNull();
    expect(getLocalizedTranslation(undefined, 'en')).toBeNull();
  });
});
