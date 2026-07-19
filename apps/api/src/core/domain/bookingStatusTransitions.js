/**
 * Booking status transition rules — Sprint 5 §9's MVP, no-payment-gateway
 * machine (see docs/SPRINT_5_DATABASE_FOUNDATION.md §5.1 for the state
 * diagram this encodes). Pure domain logic — no database access, no
 * Express — so it is fully unit-testable today and ready for the
 * Bookings module's Service layer (a future sprint) to import directly
 * rather than reimplement.
 */

const TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['PENDING_VENDOR']),
  PENDING_VENDOR: Object.freeze(['CONFIRMED', 'REJECTED', 'EXPIRED']),
  CONFIRMED: Object.freeze([
    'CANCELLED_BY_CUSTOMER',
    'CANCELLED_BY_VENDOR',
    'COMPLETED',
    'NO_SHOW',
  ]),
  REJECTED: Object.freeze([]),
  CANCELLED_BY_CUSTOMER: Object.freeze([]),
  CANCELLED_BY_VENDOR: Object.freeze([]),
  COMPLETED: Object.freeze([]),
  NO_SHOW: Object.freeze([]),
  EXPIRED: Object.freeze([]),
});

export const BOOKING_STATUSES = Object.freeze(Object.keys(TRANSITIONS));

export function isValidBookingStatusTransition(fromStatus, toStatus) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) {
    throw new TypeError(`Unknown booking status "${fromStatus}".`);
  }
  if (!(toStatus in TRANSITIONS)) {
    throw new TypeError(`Unknown booking status "${toStatus}".`);
  }
  return allowed.includes(toStatus);
}

export function isTerminalBookingStatus(status) {
  if (!(status in TRANSITIONS)) {
    throw new TypeError(`Unknown booking status "${status}".`);
  }
  return TRANSITIONS[status].length === 0;
}

export default {
  BOOKING_STATUSES,
  isValidBookingStatusTransition,
  isTerminalBookingStatus,
};
