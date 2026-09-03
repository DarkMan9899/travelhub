import { describe, test, expect } from 'vitest';
import {
  buildLocaleUrl,
  buildHreflangAlternates,
  stripNonCanonicalParams,
} from './urls.js';
import { SUPPORTED_LOCALES, getSiteOrigin } from './seoConfig.js';

describe('buildLocaleUrl', () => {
  test('builds the home URL for a locale with no trailing path', () => {
    expect(buildLocaleUrl('en', '')).toBe(`${getSiteOrigin()}/en`);
  });

  test('builds a nested path URL', () => {
    expect(buildLocaleUrl('en', 'categories/hotels')).toBe(
      `${getSiteOrigin()}/en/categories/hotels`,
    );
  });

  test('strips leading and trailing slashes from the path', () => {
    expect(buildLocaleUrl('en', '/categories/hotels/')).toBe(
      `${getSiteOrigin()}/en/categories/hotels`,
    );
  });

  test('defaults path to empty string when omitted', () => {
    expect(buildLocaleUrl('ru')).toBe(`${getSiteOrigin()}/ru`);
  });

  describe('query normalization (2026 SEO audit — centralized canonical builder)', () => {
    test('strips non-canonical noise params from a path carrying a query string', () => {
      expect(
        buildLocaleUrl(
          'en',
          'search?sort=price&utm_source=newsletter&cursor=abc',
        ),
      ).toBe(`${getSiteOrigin()}/en/search`);
    });

    test('preserves params that genuinely identify distinct indexable content', () => {
      expect(buildLocaleUrl('en', 'search?keyword=yerevan')).toBe(
        `${getSiteOrigin()}/en/search?keyword=yerevan`,
      );
    });

    test('keeps genuine params while dropping noise params in the same URL', () => {
      expect(
        buildLocaleUrl('en', 'search?keyword=yerevan&sort=price&ref=home'),
      ).toBe(`${getSiteOrigin()}/en/search?keyword=yerevan`);
    });

    test('canonicalizes param order so equivalent URLs collapse to one canonical string', () => {
      const a = buildLocaleUrl('en', 'search?categoryId=5&keyword=yerevan');
      const b = buildLocaleUrl('en', 'search?keyword=yerevan&categoryId=5');
      expect(a).toBe(b);
    });

    test('a path with no query string is unaffected (every current page-level caller)', () => {
      expect(buildLocaleUrl('en', 'listings/villa-in-yerevan')).toBe(
        `${getSiteOrigin()}/en/listings/villa-in-yerevan`,
      );
    });

    test('drops a trailing "?" with no real params left after stripping', () => {
      expect(buildLocaleUrl('en', 'search?sort=price')).toBe(
        `${getSiteOrigin()}/en/search`,
      );
    });
  });
});

describe('buildHreflangAlternates', () => {
  test('emits one entry per supported locale plus a self-referencing x-default', () => {
    const alternates = buildHreflangAlternates('categories/tours');

    expect(alternates).toHaveLength(SUPPORTED_LOCALES.length + 1);
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(alternates).toContainEqual({
        hrefLang: locale,
        href: buildLocaleUrl(locale, 'categories/tours'),
      });
    });
  });

  test('x-default always points at the hy (default locale) URL', () => {
    const alternates = buildHreflangAlternates('about');
    const xDefault = alternates.find((entry) => entry.hrefLang === 'x-default');

    expect(xDefault.href).toBe(buildLocaleUrl('hy', 'about'));
  });

  test('works for the home page (empty path)', () => {
    const alternates = buildHreflangAlternates();
    expect(alternates.find((entry) => entry.hrefLang === 'en').href).toBe(
      buildLocaleUrl('en', ''),
    );
  });
});

describe('stripNonCanonicalParams', () => {
  test('removes booking-state, tracking, and pagination params', () => {
    const params = new URLSearchParams(
      'checkIn=2026-09-01&checkOut=2026-09-05&guests=2&currency=USD&sort=price&cursor=abc&view=grid&ref=homepage&utm_source=newsletter&fbclid=xyz&gclid=xyz',
    );

    const stripped = stripNonCanonicalParams(params);

    expect([...stripped.keys()]).toHaveLength(0);
  });

  test('(P1.1) removes the real dateFrom/dateTo search params', () => {
    const params = new URLSearchParams('dateFrom=2026-09-01&dateTo=2026-09-05');
    const stripped = stripNonCanonicalParams(params);
    expect([...stripped.keys()]).toHaveLength(0);
  });

  test('keeps params that genuinely represent distinct indexable content', () => {
    const params = new URLSearchParams('categoryId=5&keyword=yerevan');

    const stripped = stripNonCanonicalParams(params);

    expect(stripped.get('categoryId')).toBe('5');
    expect(stripped.get('keyword')).toBe('yerevan');
  });

  test('is case-insensitive on the utm_ prefix', () => {
    const params = new URLSearchParams('UTM_campaign=summer');
    const stripped = stripNonCanonicalParams(params);
    expect([...stripped.keys()]).toHaveLength(0);
  });

  test('does not mutate the input params', () => {
    const params = new URLSearchParams('sort=price&keyword=yerevan');
    stripNonCanonicalParams(params);
    expect(params.get('sort')).toBe('price');
  });
});
