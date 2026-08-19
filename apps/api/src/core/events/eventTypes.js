/**
 * Domain event type constants (Phase 13 — Notifications).
 *
 * Naming convention every future publisher MUST follow so subscribers can
 * keep matching on stable strings across modules/deployments:
 *   "<resourceType>.<pastTenseVerb>", e.g. "booking.created".
 *
 * Only event types with a REAL publisher wired this phase are defined
 * here — no speculative `PAYMENT_*`/`MESSAGE_*`/`AI_*` constants. Adding
 * a future event type is a one-line addition to this file; it never
 * requires touching `DomainEventBus` or any existing subscriber.
 */

export const EVENT_TYPES = Object.freeze({
  BOOKING_CREATED: 'booking.created',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_REJECTED: 'booking.rejected',
  BOOKING_CANCELLED: 'booking.cancelled',
  BOOKING_COMPLETED: 'booking.completed',
  REVIEW_SUBMITTED: 'review.submitted',
  FAVORITE_ADDED: 'favorite.added',
  PARTNER_APPROVED: 'partner.approved',
  LISTING_APPROVED: 'listing.approved',
  LISTING_REJECTED: 'listing.rejected',
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_ARCHIVED: 'conversation.archived',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_READ: 'message.read',
  ATTACHMENT_UPLOADED: 'attachment.uploaded',
  // Phase 16 (Payment Infrastructure). `PAYMENT_PROCESSING` is the one
  // deliberate exception to the strict past-tense-verb convention above —
  // it names an ongoing state, not a completed action, matching how
  // `payment_intent_statuses.PROCESSING` itself is named.
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_PROCESSING: 'payment.processing',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELLED: 'payment.cancelled',
  REFUND_CREATED: 'refund.created',
  REFUND_SUCCEEDED: 'refund.succeeded',
  REFUND_FAILED: 'refund.failed',
  // P0.2 (Master Roadmap) — published by BookingService#cancelBooking
  // when a customer cancels a paid booking: cancellationRefundPolicy.js
  // deliberately does not auto-refund a customer-initiated cancellation
  // (that requires a real, not-invented, per-listing policy this app
  // doesn't have yet), but the system must never leave this silent —
  // this is the queryable signal an admin surface/notification listener
  // can act on. `bookings.refund_status = 'REQUIRES_MANUAL_REVIEW'` is
  // the persisted source of truth either way, independent of whether
  // anything currently subscribes to this event.
  REFUND_REVIEW_REQUIRED: 'refund.review_required',
  // Phase 17 (Inventory, Availability & Connectivity).
  INVENTORY_BLOCKED: 'inventory.blocked',
  INVENTORY_UNBLOCKED: 'inventory.unblocked',
  EXTERNAL_RESERVATION_CREATED: 'external_reservation.created',
  EXTERNAL_RESERVATION_CANCELLED: 'external_reservation.cancelled',
  INVENTORY_HOLD_EXPIRED: 'inventory.hold_expired',
  INVENTORY_SYNC_COMPLETED: 'inventory.sync_completed',
  INVENTORY_SYNC_FAILED: 'inventory.sync_failed',
  INVENTORY_SYNC_CONFLICT: 'inventory.sync_conflict',
});

export default EVENT_TYPES;
