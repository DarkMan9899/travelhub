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
 *
 * P2.2B fix: `computeEstimatedTotal` now takes the selected unit's
 * `bookableUnitTypeCode` and, for accommodation types, sums only the
 * checkout-exclusive consumed range (`accommodationDateSemantics.js`) —
 * previously this summed every day inclusive of the checkout day, one
 * night higher than what `bookingService.js#resolveItem` actually
 * charges for any HOTEL_ROOM/PROPERTY_UNIT booking. Non-accommodation
 * types (and a caller that omits the type) are unaffected — still the
 * original inclusive-both-ends sum, matching the backend's own
 * `resolveConsumedRange` default.
 */

import { resolveConsumedRange } from './accommodationDateSemantics.js';

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
 * @param {string} [bookableUnitTypeCode] - selected unit's type; accommodation
 *   types (HOTEL_ROOM/PROPERTY_UNIT) are summed checkout-exclusive, everything
 *   else (including an omitted type) stays inclusive of both endpoints.
 * @returns {{amount: number, currency: string}|null}
 */
export function computeEstimatedTotal(
  dateRange,
  priceByDate,
  quantity,
  bookableUnitTypeCode,
) {
  if (!dateRange.start || !dateRange.end) return null;

  const { dateFrom, dateTo } = resolveConsumedRange(
    bookableUnitTypeCode,
    dateRange.start,
    dateRange.end,
  );

  let cursor = dateFrom;
  let total = 0;
  let currency = null;
  while (cursor <= dateTo) {
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
