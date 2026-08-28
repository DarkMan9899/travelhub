/**
 * `bookings.refund_status` vocabulary — a plain, unconstrained
 * `VARCHAR(30)` (migration 0028), not an FK/lookup table, so this is the
 * single source of truth for its valid values rather than duplicating
 * the list wherever it's read/written/validated.
 *
 * Deliberately named/exported distinctly from `refundStatusTransitions.js`'s
 * own `REFUND_STATUSES` — that file governs the unrelated `refunds.status`
 * entity lifecycle (CREATED/PROCESSING/SUCCEEDED/FAILED/CANCELLED,
 * Phase 16), a real state machine with its own lookup table. This one
 * governs the booking-level refund-outcome *summary* column instead —
 * same-sounding name, different table, different concept; the distinct
 * `BOOKING_REFUND_STATUSES` name exists specifically to avoid that
 * confusion.
 *
 * Launch-blocker remediation (P0-B) added `MANUALLY_REFUNDED` and
 * `RESOLVED_NO_REFUND` — both application-level only, no migration
 * (see `bookingService.js#resolveManualReviewRefundSystemInternal` /
 * `#resolveRefundReviewWithoutRefund` for their write paths).
 */

export const BOOKING_REFUND_STATUSES = Object.freeze([
  'NOT_APPLICABLE',
  'AUTO_REFUNDED',
  'REQUIRES_MANUAL_REVIEW',
  'REFUND_FAILED',
  'MANUALLY_REFUNDED',
  'RESOLVED_NO_REFUND',
]);

export default { BOOKING_REFUND_STATUSES };
