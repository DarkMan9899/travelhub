# Module: search

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it will
consume.

**Application Foundation status:** `SearchPageContent` still renders
`UnderConstructionPage` at the real `/:locale/search` route — no search
_results_ logic yet, that's a later phase.

**Phase 3 addition (Premium Homepage):** `useCategoriesQuery`
(`GET /search/categories`) and `useSuggestionsQuery`
(`GET /search/suggestions`) are real, live query hooks, consumed by the
`home` module's Categories section and Hero search bar respectively
(§6.3's cross-module export rule) — not placeholders.

**Phase 4 (Search & Discovery):** `SearchPageContent` now renders real
`GET /search` results — `UnderConstructionPage` is retired from this
route. Classic-search filter state lives in the URL
(`hooks/useSearchFilters.js` + `schemas/searchParams.js`); results come
from `queries/useSearchListingsQuery.js`, a `useInfiniteQuery` over the
backend's own cursor pagination (`meta.next_cursor`/`meta.has_more` —
`apps/api/src/infrastructure/database/pagination.js`), rendered as a
"Load more" grid rather than numbered pages, since the backend has no
total-count concept to number pages against.

Only filters the backend actually supports are exposed
(`apps/api/src/modules/search/validators/searchValidators.js`):

- **Destination / keyword** — free text, debounced, maps to the
  backend's `keyword` FULLTEXT param. The URL param is named
  `destination` (not `keyword`) to match what the Homepage's
  `SearchWidget` already sends when it links here.
- **Category** — a real `Select`, options from the existing
  `useCategoriesQuery` (`GET /search/categories`).
- **Sort** — `newest`/`oldest`/`alphabetical`/`relevance`, mirroring
  `apps/api/src/core/domain/sortOptions.js`'s real enum. Lives at the
  top-level `src/constants/sortOptions.js` (Phase 9), not inside this
  module, since `modules/listings` also needs it for its own "My
  Listings" sort control and may not depend on `search`
  (FRONTEND_ARCHITECTURE.md §6.3's dependency direction). `relevance` is
  only offered once a destination/keyword is present — it's a no-op
  without one, and the backend itself silently downgrades to `newest`
  in that case.

Deliberately **not** built, and why:

- **City / Country / Region** — `GET /search` accepts `cityId`/
  `countryId`, but no endpoint anywhere in `apps/api/src/routes/v1.js`
  enumerates real cities/countries to populate a picker from. Building
  a dropdown here would mean hardcoding a fake option list against a
  real filter param — the exact "invented functionality" this phase's
  brief rules out. These two params stay deep-link-only.
- **Property type** (`listingType`) — accepted by the backend, but
  (like city/country) has no enumeration endpoint; `listing_types` is a
  small seeded reference table with no `GET` route. `categoryId` already
  covers materially the same "kind of place" concept via a real,
  localized, endpoint-backed list, so it isn't duplicated here.

**Correction (P1.1 / Phase 4.2 / P2.2D — this section previously said
the following were deliberately not built; they now are):**

- **Dates / guests** — real `GET /search` params
  (`dateFrom`/`dateTo`/`guests`, `SearchFilters.jsx`'s own date-range
  picker and guest-count `Select`, backed by `useSearchFilters`/
  `schemas/searchParams.js`), filtering against the real Inventory
  Engine (`bookable_units`/`availability_calendar`/`blackout_dates`), not
  a no-op. `dateFrom`/`dateTo` are checkout-exclusive nights for
  `HOTEL_ROOM`/`PROPERTY_UNIT` units and inclusive-both-ends for every
  other type (`accommodationDateSemantics.js`, applied per-unit inside
  the same query, not a second definition). `guests` is checked against
  a unit's real `max_guests` occupancy, never against room inventory
  quantity.
- **Rating / amenities / price tier / bedrooms / star rating / etc.** —
  real, catalog-driven dynamic filters (`DynamicFilterPanel`,
  `GET /search/filters`), not hardcoded. `rating_average`/`review_count`
  are real DTO fields, aggregated from approved reviews.
- **Price** — `toSearchResultResponse`'s `price_amount`/
  `price_currency_code` is a per-listing "from" price: the cheapest real
  `bookable_units.base_price_amount` among a listing's units when they
  all share one currency, falling back to the legacy per-listing
  `listing_pricing` row, and `null` (never a fabricated/mismatched
  number) when a listing's units are priced in more than one currency.
  The full current DTO field list is
  `id, partner_id, listing_type, slug, status, title, summary, city_id,
city_name, country_id, cover_image_url, price_amount,
price_currency_code, media_count, rating_average, review_count,
created_at`.

**Future AI Search preparation:** `SearchResults` takes a plain
`results` array plus loading/error/pagination props — it has no
knowledge of `useSearchListingsQuery`, `useSearchFilters`, or "classic"
vs. a future AI-search mode. `SearchPageContent` is the intended seam:
a later AI-search input would be a sibling to `SearchFilters` with its
own state/query hook, both ultimately feeding the same `SearchResults`,
rather than a rewrite of it.

## Folder contents (per FRONTEND_ARCHITECTURE.md §3.2 / §6.2)

- `components/` — module-owned UI, composing `@desavii/ui` primitives
- `hooks/` — module-specific custom hooks
- `queries/` — React Query query definitions (Ch. 14)
- `mutations/` — React Query mutation definitions (Ch. 14)
- `schemas/` — React Hook Form validation schemas (Ch. 15)
- `utils/` — module-specific pure helpers
- `constants/` — module-specific enums/constants
- `index.js` — this module's public export surface (Ch. 6.2) — the ONLY
  entry point other modules may import from (Ch. 6.3's cross-module rule)
