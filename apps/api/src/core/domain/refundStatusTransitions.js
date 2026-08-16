/**
 * Refund status transition rules — Phase 16. Mirrors
 * `bookingStatusTransitions.js`/`paymentStatusTransitions.js`'s exact
 * shape. A refund has its own lifecycle, entirely separate from the
 * Payment it refunds — the original payment row is never mutated into
 * "being" a refund; `payments.refunded_amount` is only ever updated as a
 * derived rollup once a refund reaches `SUCCEEDED`.
 */

const TRANSITIONS = Object.freeze({
  // SUCCEEDED/FAILED are reachable directly from CREATED, not only via
  // PROCESSING — `LocalPaymentProvider#refundPayment` (and many real
  // providers' refund APIs) resolve synchronously in one step, without an
  // intermediate processing phase, mirroring the exact same shape as
  // `paymentStatusTransitions.js`'s CREATED entry.
  CREATED: Object.freeze(['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
  PROCESSING: Object.freeze(['SUCCEEDED', 'FAILED']),
  SUCCEEDED: Object.freeze([]),
  FAILED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
});

export const REFUND_STATUSES = Object.freeze(Object.keys(TRANSITIONS));

export function isValidRefundStatusTransition(fromStatus, toStatus) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) {
    throw new TypeError(`Unknown refund status "${fromStatus}".`);
  }
  if (!(toStatus in TRANSITIONS)) {
    throw new TypeError(`Unknown refund status "${toStatus}".`);
  }
  return allowed.includes(toStatus);
}

export function isTerminalRefundStatus(status) {
  if (!(status in TRANSITIONS)) {
    throw new TypeError(`Unknown refund status "${status}".`);
  }
  return TRANSITIONS[status].length === 0;
}

export default {
  REFUND_STATUSES,
  isValidRefundStatusTransition,
  isTerminalRefundStatus,
};
