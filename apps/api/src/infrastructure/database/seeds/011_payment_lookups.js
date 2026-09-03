/**
 * Seeds the Payments lookup tables (migration 0024) and additively
 * extends the pre-existing `payment_statuses` lookup (migration 0008)
 * with the online-payment vocabulary Phase 16 introduces. The original
 * four MVP/offline codes (`NOT_REQUIRED_ON_PLATFORM`, `PAY_AT_PROPERTY`,
 * `PAID_OFFLINE`, `REFUNDED_OFFLINE`) are untouched — this is a one-row-
 * insert extension, never a schema change, exactly the pattern this
 * lookup table's own migration comment anticipated.
 */

import { upsertByCode } from './helpers.js';

export default async function seedPaymentLookups(connection) {
  await upsertByCode(connection, 'payment_intent_statuses', [
    { code: 'CREATED', name: 'Created' },
    { code: 'REQUIRES_ACTION', name: 'Requires Action' },
    { code: 'PROCESSING', name: 'Processing' },
    { code: 'AUTHORIZED', name: 'Authorized' },
    { code: 'SUCCEEDED', name: 'Succeeded' },
    { code: 'FAILED', name: 'Failed' },
    { code: 'CANCELLED', name: 'Cancelled' },
    { code: 'PARTIALLY_REFUNDED', name: 'Partially Refunded' },
    { code: 'REFUNDED', name: 'Refunded' },
  ]);

  await upsertByCode(connection, 'refund_statuses', [
    { code: 'CREATED', name: 'Created' },
    { code: 'PROCESSING', name: 'Processing' },
    { code: 'SUCCEEDED', name: 'Succeeded' },
    { code: 'FAILED', name: 'Failed' },
    { code: 'CANCELLED', name: 'Cancelled' },
  ]);

  // Additive extension of the existing bookings.payment_status_id
  // vocabulary (migration 0008 / seed 001) — online payment is now a
  // real, supported path alongside the pre-existing offline codes.
  await upsertByCode(connection, 'payment_statuses', [
    { code: 'NOT_REQUIRED_ON_PLATFORM', name: 'Not Required on Platform' },
    { code: 'PAY_AT_PROPERTY', name: 'Pay at Property' },
    { code: 'PAID_OFFLINE', name: 'Paid Offline' },
    { code: 'REFUNDED_OFFLINE', name: 'Refunded Offline' },
    { code: 'AWAITING_PAYMENT', name: 'Awaiting Payment' },
    { code: 'PAID_ONLINE', name: 'Paid Online' },
    { code: 'PAYMENT_FAILED', name: 'Payment Failed' },
    { code: 'PARTIALLY_REFUNDED_ONLINE', name: 'Partially Refunded Online' },
    { code: 'REFUNDED_ONLINE', name: 'Refunded Online' },
    // Manual-capture booking payment flow: the customer authorizes funds
    // at checkout, but they are only ever captured once the vendor
    // accepts the booking (see paymentService.js's
    // BOOKING_PAYMENT_STATUS_BY_INTENT_STATUS). Distinct from
    // AWAITING_PAYMENT (no funds committed at all) and PAYMENT_FAILED
    // (nothing declined here — the vendor simply hasn't acted yet).
    {
      code: 'AUTHORIZED_AWAITING_CAPTURE',
      name: 'Authorized, Awaiting Capture',
    },
    // The vendor rejected the booking (or the customer cancelled it)
    // before the authorization was ever captured — the hold on the
    // customer's card is released, never charged. Distinct from
    // PAYMENT_FAILED (a declined/errored payment attempt) and from
    // REFUNDED_ONLINE (money was actually captured, then returned).
    { code: 'PAYMENT_VOIDED', name: 'Payment Voided' },
  ]);
}
