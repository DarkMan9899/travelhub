/**
 * `bookings.booking_reference` generator — Sprint 10.
 *
 * Fits the column's `VARCHAR(30)` width with room to spare: `BK-` + an
 * 8-digit UTC date + `-` + 8 random characters from a 32-symbol alphabet
 * that deliberately excludes visually-ambiguous characters (`0`/`O`,
 * `1`/`I`/`L`) since this value is customer-facing (a support agent may
 * read it back over the phone). Collisions are handled by the caller
 * retrying against the table's existing `UNIQUE` constraint
 * (`mysqlBookingRepository.js`) — this function has no database access
 * (`core` may depend only on `core`), so it cannot check uniqueness itself.
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

/** @param {Date} [now] */
export function generateBookingReference(now = new Date()) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `BK-${datePart}-${randomSegment(RANDOM_SEGMENT_LENGTH)}`;
}

export default generateBookingReference;
