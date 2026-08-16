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
 * The Homepage widget also sends `checkIn`/`checkOut`/`guests` — the
 * backend's search endpoint has no filter for any of them (see
 * `apps/api/src/modules/search/validators/searchValidators.js`), so they
 * are intentionally never read here. They pass through inertly on first
 * load and are dropped the moment this page's own filters are next
 * updated (`buildSearchParams` only ever writes the keys below).
 *
 * `dynamicFilters` (Phase 4.2) is the one deliberate exception to "every
 * key is named here": it holds the generic `attr_{code}` / `attr_{code}
 * _min` / `attr_{code}_max` / `amenityIds` params `GET /search/filters`
 * declares as data (`DynamicFilterPanel`'s catalog), not as a fixed enum
 * this file could name in advance — "do not hardcode filter lists in the
 * frontend" applies here too. Only a key matching that exact convention
 * (an `attr_` prefix, or the literal `amenityIds`) is swept into it — a
 * plain "any other key" sweep would also capture the Homepage widget's
 * `checkIn`/`checkOut`/`guests`, which this file's own contract above
 * says must pass through inertly, not be treated as an active filter.
 */

import { SORT_KEYS, DEFAULT_SORT_KEY } from '../../../constants/sortOptions.js';

export const SEARCH_PARAM_KEYS = Object.freeze({
  destination: 'destination',
  categoryId: 'categoryId',
  sort: 'sort',
});

const DYNAMIC_FILTER_KEY_PATTERN = /^attr_/;
const AMENITY_IDS_KEY = 'amenityIds';

function isDynamicFilterKey(key) {
  return key === AMENITY_IDS_KEY || DYNAMIC_FILTER_KEY_PATTERN.test(key);
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {{ destination: string, categoryId: number|undefined, sort: string, dynamicFilters: Object<string, string> }}
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

  const dynamicFilters = {};
  searchParams.forEach((value, key) => {
    if (!value || !isDynamicFilterKey(key)) return;
    dynamicFilters[key] = value;
  });

  return { destination, categoryId, sort, dynamicFilters };
}

/**
 * Builds a fresh `URLSearchParams` from filter state — omits any key at
 * its empty/default value so the URL stays clean (`/search` rather than
 * `/search?destination=&categoryId=&sort=newest` for the all-defaults
 * case), and never carries over unrelated params (see file header).
 * @param {{ destination?: string, categoryId?: number, sort?: string, dynamicFilters?: Object<string, string> }} filters
 * @returns {URLSearchParams}
 */
export function buildSearchParams({
  destination,
  categoryId,
  sort,
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
  { destination, categoryId, partnerId, cityId, sort, dynamicFilters = {} },
  locale,
) {
  const query = { ...dynamicFilters };
  if (destination) query.keyword = destination;
  if (categoryId) query.categoryId = categoryId;
  if (partnerId) query.partnerId = partnerId;
  if (cityId) query.cityId = cityId;
  if (sort) query.sort = sort;
  if (locale) query.locale = locale;
  return query;
}

export default {
  SEARCH_PARAM_KEYS,
  parseSearchParams,
  buildSearchParams,
  toSearchQueryParams,
};
