/**
 * Phase 20 — canonical/hreflang URL builders. Pure functions (no React,
 * no DOM), so they're trivially unit-testable and reusable from the
 * Node-side prerender/sitemap scripts as well as from React components.
 *
 * `path` throughout is the LOCALE-FREE route path (e.g. `listings/boutique-
 * yerevan-hotel`, `categories/hotels`, or `''` for the home page) — every
 * builder here is the one place that decides how the locale segment and
 * the site origin get glued on, so a page component never hand-assembles
 * a URL string itself.
 */

import { SUPPORTED_LOCALES, getSiteOrigin } from './seoConfig.js';

function normalizePath(path) {
  const trimmed = (path ?? '').replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed;
}

/**
 * Strips query parameters that never represent genuinely distinct
 * indexable content (booking dates, guest counts, tracking/utm params,
 * sort/pagination cursors, currency, view toggles) before a canonical
 * URL is built from the current location. Phase 20 §8/§9's crawl-trap
 * control: a canonical tag always points at the clean, stable form of a
 * page, even when the visited URL carries interaction state.
 */
// P1.1 (Master Roadmap): `dateFrom`/`dateTo` are the real, currently-
// used search date-range params (see modules/search/schemas/
// searchParams.js) — `checkIn`/`checkOut` stay listed too as defensive
// cleanup for any already-indexed/bookmarked URL still carrying the old
// (never-functional) names.
const NON_CANONICAL_PARAM_PATTERN =
  /^(utm_|checkIn$|checkOut$|dateFrom$|dateTo$|guests$|currency$|sort$|cursor$|view$|ref$|fbclid$|gclid$)/i;

export function stripNonCanonicalParams(searchParams) {
  const params = new URLSearchParams(searchParams);
  [...params.keys()].forEach((key) => {
    if (NON_CANONICAL_PARAM_PATTERN.test(key)) {
      params.delete(key);
    }
  });
  return params;
}

/**
 * Builds an absolute, canonical URL for `path` in `locale`.
 *
 * `path` is normally query-free (every current caller builds it from a
 * slug/id, never from `location.search`) — but this is the ONE place
 * every canonical/hreflang/OG URL in the app is assembled, so it's also
 * the centralized place to defend against a future caller that DOES
 * carry a query string (e.g. `path: 'search?sort=price&keyword=yerevan'`):
 * non-canonical noise (`stripNonCanonicalParams` — utm_*, ref, fbclid,
 * gclid, checkIn/checkOut, dateFrom/dateTo, guests, currency, sort,
 * cursor, view) is stripped, while any param that genuinely identifies
 * distinct indexable content (e.g. `keyword`, `categoryId`) is kept and
 * canonicalized in a stable, alphabetically-sorted order so two
 * equivalent URLs with params in a different order collapse to the same
 * canonical string — never accidentally strip real content, never leave
 * an uncontrolled crawl-space open either.
 */
export function buildLocaleUrl(locale, path = '') {
  const origin = getSiteOrigin();
  const [rawPath, rawQuery] = String(path ?? '').split('?');
  const normalized = normalizePath(rawPath);
  const base = normalized
    ? `${origin}/${locale}/${normalized}`
    : `${origin}/${locale}`;

  if (!rawQuery) return base;

  const preserved = stripNonCanonicalParams(rawQuery);
  preserved.sort();
  const queryString = preserved.toString();
  return queryString ? `${base}?${queryString}` : base;
}

/**
 * Builds the hreflang alternate-link set for a locale-free `path`: one
 * entry per supported locale plus `x-default` pointing at the default
 * locale's URL. Google/Bing require self-referencing hreflang, so the
 * current locale's own URL is included, not skipped.
 */
export function buildHreflangAlternates(path = '') {
  const alternates = SUPPORTED_LOCALES.map((locale) => ({
    hrefLang: locale,
    href: buildLocaleUrl(locale, path),
  }));
  alternates.push({
    hrefLang: 'x-default',
    href: buildLocaleUrl('hy', path),
  });
  return alternates;
}

export default {
  buildLocaleUrl,
  buildHreflangAlternates,
  stripNonCanonicalParams,
};
