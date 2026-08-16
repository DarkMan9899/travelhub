/**
 * Human-facing reference generators — Sprint 10, extended in Phase 16 for
 * `payments.payment_reference`/`refunds.refund_reference`.
 *
 * Fits a `VARCHAR(30)` column with room to spare: a short prefix + an
 * 8-digit UTC date + `-` + 8 random characters from a 32-symbol alphabet
 * that deliberately excludes visually-ambiguous characters (`0`/`O`,
 * `1`/`I`/`L`) since these values are customer-facing (a support agent may
 * read one back over the phone). Collisions are handled by the caller
 * retrying against the table's existing `UNIQUE` constraint — this module
 * has no database access (`core` may depend only on `core`), so it cannot
 * check uniqueness itself.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RANDOM_SEGMENT_LENGTH = 8;

function randomSegment(length) {
  let segment = '';
  for (let i = 0; i < length; i += 1) {
    segment += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return segment;
}

function generateReference(prefix, now) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${datePart}-${randomSegment(RANDOM_SEGMENT_LENGTH)}`;
}

/** @param {Date} [now] */
export function generateBookingReference(now = new Date()) {
  return generateReference('BK', now);
}

/** @param {Date} [now] */
export function generatePaymentReference(now = new Date()) {
  return generateReference('PAY', now);
}

/** @param {Date} [now] */
export function generateRefundReference(now = new Date()) {
  return generateReference('RF', now);
}

export default generateBookingReference;
