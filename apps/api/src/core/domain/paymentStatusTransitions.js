/**
 * Payment (PaymentIntent) status transition rules — Phase 16. Mirrors
 * `bookingStatusTransitions.js`'s exact shape: pure domain logic, no
 * database access, no Express, fully unit-testable, imported directly by
 * the Payments module's Service layer rather than reimplemented.
 *
 * This is the Payment entity's own fine-grained processing state machine —
 * distinct from `bookings.payment_status_id` (a coarser, booking-facing
 * summary drawn from the existing `payment_statuses` lookup table).
 */

const TRANSITIONS = Object.freeze({
  // SUCCEEDED/AUTHORIZED are reachable directly from CREATED, not only via
  // PROCESSING — many providers (including LocalPaymentProvider's default
  // 'SUCCESS' scenario) resolve a payment intent synchronously in one
  // step, without an intermediate processing/authorization phase.
  CREATED: Object.freeze([
    'REQUIRES_ACTION',
    'PROCESSING',
    'AUTHORIZED',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
  ]),
  REQUIRES_ACTION: Object.freeze(['PROCESSING', 'CANCELLED', 'FAILED']),
  PROCESSING: Object.freeze(['AUTHORIZED', 'SUCCEEDED', 'FAILED']),
  AUTHORIZED: Object.freeze(['SUCCEEDED', 'CANCELLED', 'FAILED']),
  SUCCEEDED: Object.freeze(['PARTIALLY_REFUNDED', 'REFUNDED']),
  PARTIALLY_REFUNDED: Object.freeze(['PARTIALLY_REFUNDED', 'REFUNDED']),
  FAILED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
  REFUNDED: Object.freeze([]),
});

export const PAYMENT_STATUSES = Object.freeze(Object.keys(TRANSITIONS));

export function isValidPaymentStatusTransition(fromStatus, toStatus) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) {
    throw new TypeError(`Unknown payment status "${fromStatus}".`);
  }
  if (!(toStatus in TRANSITIONS)) {
    throw new TypeError(`Unknown payment status "${toStatus}".`);
  }
  return allowed.includes(toStatus);
}

export function isTerminalPaymentStatus(status) {
  if (!(status in TRANSITIONS)) {
    throw new TypeError(`Unknown payment status "${status}".`);
  }
  return TRANSITIONS[status].length === 0;
}

/** A booking may accept a new payment attempt only when no existing payment for it is still "live" (not yet failed/cancelled/refunded). */
export function isActivePaymentStatus(status) {
  if (!(status in TRANSITIONS)) {
    throw new TypeError(`Unknown payment status "${status}".`);
  }
  return !['FAILED', 'CANCELLED', 'REFUNDED'].includes(status);
}

export default {
  PAYMENT_STATUSES,
  isValidPaymentStatusTransition,
  isTerminalPaymentStatus,
  isActivePaymentStatus,
};
