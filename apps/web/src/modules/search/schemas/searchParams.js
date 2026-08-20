/**
 * Search URL <-> filter-state translation — the single place that knows
 * how "classic search" state is represented in the URL
 * (FRONTEND_ARCHITECTURE.md's "search filters live in URL search params,
 * must be shareable/bookmarkable" rule). Pure functions only, no React —
 * `useSearchFilters.js` is the hook that wires these to
 * `useSearchParams()`.
 *
 * `destination` is the URL's human-readable name for what the backend
 * calls `keyword` (`GET /search`'s free-text FULLTEXT param) — chosen to
 * match the query param the Homepage's `SearchWidget` already sends
 * (`?destination=...`), so a deep link from the Homepage lands on an
 * already-applied filter here instead of a silently-ignored one.
 *
 * P1.1 (Master Roadmap): `dateFrom`/`dateTo`/`guests` used to be
 * documented here as intentionally dropped ("the backend has no filter
 * for them") — that was true when this file was written but the backend
 * gained real, validated `dateFrom`/`dateTo`/`guests` availability
 * filters later (`apps/api/src/modules/search/validators/
 * searchValidators.js`) and this file was never updated to match, so
 * every search entry point silently discarded the dates/guest count a
 * user actually selected. They are named here like every other filter
 * now, using the exact same key names the backend query param expects
 * (no translation needed in `toSearchQueryParams`, unlike `destination`
 * -> `keyword`).
 *
 * `dynamicFilters` (Phase 4.2) is the one deliberate exception to "every
 * key is named here": it holds the generic `attr_{code}` / `attr_{code}
 * _min` / `attr_{code}_max` / `amenityIds` params `GET /search/filters`
 * declares as data (`DynamicFilterPanel`'s catalog), not as a fixed enum
 * this file could name in advance — "do not hardcode filter lists in the
 * frontend" applies here too. Only a key matching that exact convention
 * (an `attr_` prefix, or the literal `amenityIds`) is swept into it.
 */

import { SORT_KEYS, DEFAULT_SORT_KEY } from '../../../constants/sortOptions.js';

export const SEARCH_PARAM_KEYS = Object.freeze({
  destination: 'destination',
  categoryId: 'categoryId',
  sort: 'sort',
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
  guests: 'guests',
});

const DYNAMIC_FILTER_KEY_PATTERN = /^attr_/;
const AMENITY_IDS_KEY = 'amenityIds';
// Same shape the backend's own `isoDateSchema` requires — a URL param
// that doesn't match this is never worth sending upstream just to have
// the backend reject it with a 422.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GUESTS = 50;

function isDynamicFilterKey(key) {
  return key === AMENITY_IDS_KEY || DYNAMIC_FILTER_KEY_PATTERN.test(key);
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {{ destination: string, categoryId: number|undefined, sort: string, dateFrom: string|undefined, dateTo: string|undefined, guests: number|undefined, dynamicFilters: Object<string, string> }}
 */
export function parseSearchParams(searchParams) {
  const destination = (
    searchParams.get(SEARCH_PARAM_KEYS.destination) ?? ''
  ).trim();

  const categoryIdRaw = searchParams.get(SEARCH_PARAM_KEYS.categoryId);
  const parsedCategoryId = Number(categoryIdRaw);
  const categoryId =
    categoryIdRaw && Number.isInteger(parsedCategoryId) && parsedCategoryId > 0
      ? parsedCategoryId
      : undefined;

  const sortRaw = searchParams.get(SEARCH_PARAM_KEYS.sort);
  const sort = SORT_KEYS.includes(sortRaw) ? sortRaw : DEFAULT_SORT_KEY;

  // dateFrom/dateTo are only ever meaningful as a pair — matches the
  // backend's own `.refine` rule (`dateFrom and dateTo must be provided
  // together`) rather than silently sending a half-formed range upstream.
  const dateFromRaw = searchParams.get(SEARCH_PARAM_KEYS.dateFrom);
  const dateToRaw = searchParams.get(SEARCH_PARAM_KEYS.dateTo);
  const datesValid =
    dateFromRaw &&
    dateToRaw &&
    ISO_DATE_PATTERN.test(dateFromRaw) &&
    ISO_DATE_PATTERN.test(dateToRaw) &&
    dateToRaw >= dateFromRaw;
  const dateFrom = datesValid ? dateFromRaw : undefined;
  const dateTo = datesValid ? dateToRaw : undefined;

  const guestsRaw = searchParams.get(SEARCH_PARAM_KEYS.guests);
  const parsedGuests = Number(guestsRaw);
  const guests =
    guestsRaw &&
    Number.isInteger(parsedGuests) &&
    parsedGuests > 0 &&
    parsedGuests <= MAX_GUESTS
      ? parsedGuests
      : undefined;

  const dynamicFilters = {};
  searchParams.forEach((value, key) => {
    if (!value || !isDynamicFilterKey(key)) return;
    dynamicFilters[key] = value;
  });

  return {
    destination,
    categoryId,
    sort,
    dateFrom,
    dateTo,
    guests,
    dynamicFilters,
  };
}

/**
 * Builds a fresh `URLSearchParams` from filter state — omits any key at
 * its empty/default value so the URL stays clean (`/search` rather than
 * `/search?destination=&categoryId=&sort=newest` for the all-defaults
 * case), and never carries over unrelated params (see file header).
 * @param {{ destination?: string, categoryId?: number, sort?: string, dateFrom?: string, dateTo?: string, guests?: number, dynamicFilters?: Object<string, string> }} filters
 * @returns {URLSearchParams}
 */
export function buildSearchParams({
  destination,
  categoryId,
  sort,
  dateFrom,
  dateTo,
  guests,
  dynamicFilters = {},
}) {
  const params = new URLSearchParams();
  if (destination && destination.trim()) {
    params.set(SEARCH_PARAM_KEYS.destination, destination.trim());
  }
  if (categoryId) {
    params.set(SEARCH_PARAM_KEYS.categoryId, String(categoryId));
  }
  if (sort && sort !== DEFAULT_SORT_KEY) {
    params.set(SEARCH_PARAM_KEYS.sort, sort);
  }
  // Only ever written as a pair — see parseSearchParams's identical rule.
  if (dateFrom && dateTo) {
    params.set(SEARCH_PARAM_KEYS.dateFrom, dateFrom);
    params.set(SEARCH_PARAM_KEYS.dateTo, dateTo);
  }
  if (guests) {
    params.set(SEARCH_PARAM_KEYS.guests, String(guests));
  }
  Object.entries(dynamicFilters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params;
}

/**
 * Translates parsed filter state into the exact params `GET /search`
 * accepts. `partnerId`/`cityId` (Phase 10/Phase 20) are never part of the
 * URL-synced "classic search" filter state `parseSearchParams`/
 * `buildSearchParams` own — each is only ever passed by a caller that
 * builds its own filters object directly (`RelatedListings`'
 * `categoryId`-only precedent; `CompanyProfilePageContent`'s "this
 * company's listings" section; `DestinationPageContent`'s "listings in
 * this city" section is the `cityId` equivalent), never round-tripped
 * through the URL.
 */
export function toSearchQueryParams(
  {
    destination,
    categoryId,
    partnerId,
    cityId,
    sort,
    dateFrom,
    dateTo,
    guests,
    dynamicFilters = {},
  },
  locale,
) {
  const query = { ...dynamicFilters };
  if (destination) query.keyword = destination;
  if (categoryId) query.categoryId = categoryId;
  if (partnerId) query.partnerId = partnerId;
  if (cityId) query.cityId = cityId;
  if (sort) query.sort = sort;
  // Same key names the backend expects — no translation needed, unlike
  // destination -> keyword.
  if (dateFrom && dateTo) {
    query.dateFrom = dateFrom;
    query.dateTo = dateTo;
  }
  if (guests) query.guests = guests;
  if (locale) query.locale = locale;
  return query;
}

export default {
  SEARCH_PARAM_KEYS,
  parseSearchParams,
  buildSearchParams,
  toSearchQueryParams,
};
