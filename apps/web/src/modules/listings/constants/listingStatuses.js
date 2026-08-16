/**
 * Frontend mirror of the backend's real, fixed listing-status enum
 * (`apps/api/src/core/domain/listingStatusTransitions.js`'s
 * `LISTING_STATUSES`), not an invented list — same convention as
 * `modules/search/constants/sortOptions.js`'s `SORT_KEYS`.
 */

export const LISTING_STATUS_KEYS = Object.freeze([
  'DRAFT',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
]);

export default LISTING_STATUS_KEYS;
