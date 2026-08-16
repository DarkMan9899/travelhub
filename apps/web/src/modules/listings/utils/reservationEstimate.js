/**
 * Pure helpers for `ListingReservationWidget`'s client-side price
 * estimate — split out from the component so the actual summing logic
 * (walk an inclusive date range, sum each day's `price_amount`, bail to
 * `null` the moment any day in range has no resolvable price) is
 * directly unit-testable without mounting the widget or its query hooks,
 * mirroring the backend's own "core domain logic as pure functions"
 * convention (`core/domain/calendarExpansion.js`).
 *
 * This is always an ESTIMATE, never authoritative — the real price is
 * resolved server-side at booking-creation time from the same
 * `availability_calendar` rows, and is the only number the customer is
 * ever actually charged.
 */

export function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * @param {{start: string|null, end: string|null}} dateRange
 * @param {Record<string, {price_amount: string|number|null, price_currency: string|null}>} priceByDate
 * @param {number} quantity
 * @returns {{amount: number, currency: string}|null}
 */
export function computeEstimatedTotal(dateRange, priceByDate, quantity) {
  if (!dateRange.start || !dateRange.end) return null;

  let cursor = dateRange.start;
  let total = 0;
  let currency = null;
  while (cursor <= dateRange.end) {
    const day = priceByDate[cursor];
    if (!day || day.price_amount === null || day.price_amount === undefined) {
      return null;
    }
    total += Number(day.price_amount);
    currency = day.price_currency;
    cursor = addDays(cursor, 1);
  }
  return { amount: total * quantity, currency };
}

export default { addDays, toISODate, computeEstimatedTotal };
