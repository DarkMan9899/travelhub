/**
 * P2.2D: resolves the reservation widget's initial date range/guest count
 * from the search page's own query params, so a customer's search
 * selections survive the hop into listing detail instead of being
 * silently discarded (the search -> detail context-loss gap the P2.2D
 * preflight identified). Never trusts a malformed or stale value — falls
 * back to the widget's existing blank/1 defaults exactly as if the params
 * were never there, so a bare/direct listing URL (no params at all, or a
 * hand-edited/broken one) behaves identically to before this change.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Mirrors `modules/search/schemas/searchParams.js`'s own guest-count
// bound. Kept as a local constant rather than a cross-module import —
// this is the only value reused, not a shared contract between the two
// modules.
const MAX_GUESTS = 50;

function isValidIsoDate(value) {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value);
}

/**
 * @param {URLSearchParams} searchParams
 * @param {string} today - 'YYYY-MM-DD', for rejecting a stale/past dateFrom
 * @returns {{
 *   dateRange: { start: string|null, end: string|null },
 *   guestCount: number,
 * }}
 */
export function resolveInitialReservationState(searchParams, today) {
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const guestsRaw = searchParams.get('guests');

  let dateRange = { start: null, end: null };
  if (
    isValidIsoDate(dateFrom) &&
    isValidIsoDate(dateTo) &&
    dateFrom <= dateTo &&
    dateFrom >= today
  ) {
    dateRange = { start: dateFrom, end: dateTo };
  }

  let guestCount = 1;
  if (guestsRaw !== null) {
    const parsed = Number(guestsRaw);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_GUESTS) {
      guestCount = parsed;
    }
  }

  return { dateRange, guestCount };
}

export default resolveInitialReservationState;
