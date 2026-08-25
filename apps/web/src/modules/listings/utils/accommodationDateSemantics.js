/**
 * P2.2B — frontend mirror of the backend's own
 * `apps/api/src/core/domain/accommodationDateSemantics.js`: resolves the
 * actual calendar-day range a stay consumes and gets priced for, given
 * the bookable unit's type. `HOTEL_ROOM`/`PROPERTY_UNIT` are
 * checkout-exclusive (a guest who checks in Aug 10 and checks out Aug 13
 * stays 3 nights, not 4); every other bookable unit type keeps the
 * original inclusive-both-ends "duration" semantics unchanged.
 *
 * A deliberate, faithful port (same constant, same function names/
 * signatures) rather than a shared package import — this module has no
 * existing frontend/backend shared-code boundary to add one across, and
 * the logic is a handful of lines; duplicating it here keeps
 * `reservationEstimate.js`'s estimate consistent with what
 * `bookingService.js#resolveItem` actually charges, without inventing new
 * cross-package plumbing for P2.2B's scope.
 */

export const ACCOMMODATION_BOOKABLE_UNIT_TYPES = Object.freeze([
  'HOTEL_ROOM',
  'PROPERTY_UNIT',
]);

export function isAccommodationUnitType(bookableUnitTypeCode) {
  return ACCOMMODATION_BOOKABLE_UNIT_TYPES.includes(bookableUnitTypeCode);
}

function previousDay(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * @param {string} bookableUnitTypeCode
 * @param {string} dateFrom - 'YYYY-MM-DD', the customer's selected start date
 * @param {string} dateTo - 'YYYY-MM-DD', the customer's selected end date
 * @returns {{dateFrom: string, dateTo: string}} the range actually
 *   consumed/priced — unchanged for non-accommodation types, or for a
 *   same-day accommodation selection (`dateFrom === dateTo`, a genuine
 *   single-day charge, not zero nights).
 */
export function resolveConsumedRange(bookableUnitTypeCode, dateFrom, dateTo) {
  if (isAccommodationUnitType(bookableUnitTypeCode) && dateFrom !== dateTo) {
    return { dateFrom, dateTo: previousDay(dateTo) };
  }
  return { dateFrom, dateTo };
}

export default {
  ACCOMMODATION_BOOKABLE_UNIT_TYPES,
  isAccommodationUnitType,
  resolveConsumedRange,
};
