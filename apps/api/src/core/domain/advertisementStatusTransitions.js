/**
 * Advertisement (Featured Listings) status transition rules — Sprint 5
 * §11's manual-payment workflow (see
 * docs/SPRINT_5_DATABASE_FOUNDATION.md §5.2 for the state diagram this
 * encodes). Pure domain logic, mirrors bookingStatusTransitions.js's
 * shape.
 */

const TRANSITIONS = Object.freeze({
  REQUEST_SUBMITTED: Object.freeze(['AWAITING_OFFLINE_PAYMENT', 'REJECTED']),
  AWAITING_OFFLINE_PAYMENT: Object.freeze(['PAID_MANUAL', 'CANCELLED']),
  PAID_MANUAL: Object.freeze(['APPROVED']),
  APPROVED: Object.freeze(['SCHEDULED', 'ACTIVE']),
  SCHEDULED: Object.freeze(['ACTIVE']),
  ACTIVE: Object.freeze(['EXPIRED']),
  REJECTED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
});

export const ADVERTISEMENT_STATUSES = Object.freeze(Object.keys(TRANSITIONS));

export function isValidAdvertisementStatusTransition(fromStatus, toStatus) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) {
    throw new TypeError(`Unknown advertisement status "${fromStatus}".`);
  }
  if (!(toStatus in TRANSITIONS)) {
    throw new TypeError(`Unknown advertisement status "${toStatus}".`);
  }
  return allowed.includes(toStatus);
}

export function isTerminalAdvertisementStatus(status) {
  if (!(status in TRANSITIONS)) {
    throw new TypeError(`Unknown advertisement status "${status}".`);
  }
  return TRANSITIONS[status].length === 0;
}

export default {
  ADVERTISEMENT_STATUSES,
  isValidAdvertisementStatusTransition,
  isTerminalAdvertisementStatus,
};
