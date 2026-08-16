/**
 * Frontend mirror of the backend's real, fixed booking-status enum
 * (`apps/api/src/core/domain/bookingStatusTransitions.js`'s
 * `BOOKING_STATUSES`), not an invented list — same convention as
 * `modules/listings/constants/listingStatuses.js`.
 */

export const BOOKING_STATUS_KEYS = Object.freeze([
  'DRAFT',
  'PENDING_VENDOR',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_VENDOR',
  'COMPLETED',
  'NO_SHOW',
  'EXPIRED',
]);

export default BOOKING_STATUS_KEYS;
