/**
 * `listing_types` — a fixed, rarely-changing backend enum
 * (`apps/api/src/infrastructure/database/seeds/001_lookups.js`), not a
 * per-category dynamic catalog — no `GET /listings/types` endpoint
 * exists to fetch it from (unlike attributes/amenities/pricing models/
 * policies, which are all genuinely category-scoped data). Mirroring a
 * fixed backend enum here follows the same precedent
 * `modules/search/constants/sortOptions.js` already established for
 * `GET /search`'s fixed `sort` enum.
 */

export const LISTING_TYPES = [
  'HOTEL',
  'PROPERTY',
  'RESTAURANT',
  'TOUR',
  'CAR_RENTAL',
  'ATTRACTION',
];

export default LISTING_TYPES;
