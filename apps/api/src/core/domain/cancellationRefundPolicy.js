/**
 * Cancellation refund policy — P0.2 (Master Roadmap).
 *
 * Before this, `BookingService#cancelBooking` and the Payments module
 * were completely decoupled: a customer or vendor could cancel a
 * CONFIRMED booking with a SUCCEEDED payment, and the payment simply
 * stayed SUCCEEDED with no automatic refund trigger and no visible
 * signal that one might be owed. This is the configurable policy
 * boundary that decides WHAT should happen — `BookingService` calls
 * `resolveCancellationRefundAction` and acts on the result; it never
 * embeds refund business logic itself, so a future, real, per-listing
 * policy (this app already collects a `cancellation_policy` attribute —
 * FLEXIBLE/MODERATE/STRICT — per listing, currently unused for anything
 * beyond display) can replace this function's body without touching
 * `bookingService.js` at all.
 *
 * Deliberately conservative default, not an invented business rule: a
 * business unilaterally cancelling a customer's booking universally owes
 * a full refund (this is closer to a correctness fix than a policy
 * choice — no marketplace holds a customer's money for a cancellation
 * that wasn't their doing). A CUSTOMER's own cancellation is routed to
 * manual review rather than an invented refund percentage/cutoff-window
 * — the real business (cancellation-window, partial-refund tiers by
 * FLEXIBLE/MODERATE/STRICT) is a decision for whoever owns Desavii's
 * actual policy, not something to fabricate here. The existing admin
 * `POST /payments/:id/refund` flow already fully handles that path today.
 */

export const CANCELLATION_REFUND_ACTIONS = Object.freeze({
  AUTO_REFUND_FULL: 'AUTO_REFUND_FULL',
  REQUIRES_MANUAL_REVIEW: 'REQUIRES_MANUAL_REVIEW',
  NO_REFUND_DUE: 'NO_REFUND_DUE',
});

/**
 * @param {object} params
 * @param {'CUSTOMER'|'VENDOR'} params.cancelledByRole — mirrors
 *   `cancelBooking`'s own `isCustomer` classification; `VENDOR` also
 *   covers an admin acting under `CANCEL_ANY_PERMISSION`, the same
 *   "vendor-side" bucket `cancelBooking` already uses for the booking
 *   status itself (`CANCELLED_BY_VENDOR`).
 * @param {object|null} params.refundablePayment — the booking's
 *   SUCCEEDED/PARTIALLY_REFUNDED payment, or null if it never had one
 *   (`PaymentRepository#findRefundableForBooking`'s result).
 * @returns {'AUTO_REFUND_FULL'|'REQUIRES_MANUAL_REVIEW'|'NO_REFUND_DUE'}
 */
export function resolveCancellationRefundAction({
  cancelledByRole,
  refundablePayment,
}) {
  if (!refundablePayment) {
    return CANCELLATION_REFUND_ACTIONS.NO_REFUND_DUE;
  }
  if (cancelledByRole === 'VENDOR') {
    return CANCELLATION_REFUND_ACTIONS.AUTO_REFUND_FULL;
  }
  return CANCELLATION_REFUND_ACTIONS.REQUIRES_MANUAL_REVIEW;
}

export default {
  CANCELLATION_REFUND_ACTIONS,
  resolveCancellationRefundAction,
};
