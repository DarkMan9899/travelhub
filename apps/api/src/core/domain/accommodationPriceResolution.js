/**
 * P2.2B correctness fix — the single choke point for one day's price-
 * resolution precedence: date-specific `availability_calendar` override
 * -> the bookable unit's own `base_price_amount` -> the listing's flat
 * base price. Extracted as a pure function so both real call sites use
 * the exact same rung logic instead of two independent (and, until this
 * fix, silently divergent) implementations:
 *
 *  - `bookingService.js#resolveItem` — the authoritative price a booking
 *    is actually charged.
 *  - `availabilityService.js#getCalendar` — the public day-by-day prices
 *    `ListingReservationWidget`'s customer-facing estimate is built from.
 *
 * Before this fix, `getCalendar` only ever returned explicit override
 * rows — a day resolvable only via the unit's base price or the
 * listing's fallback (i.e. every day without its own calendar override)
 * silently came back with no price at all, making the customer's
 * estimate go blank (not merely inaccurate) for exactly the P2.2A-added
 * rungs. This function is the fix: both call sites now resolve every
 * day identically, so the customer-visible estimate can never drift from
 * what booking creation will actually charge.
 */

/** A rung only counts as resolved with BOTH an amount and a currency — matches the pre-P2.2B `isPriceMissing` guard this replaces. */
function isResolved(amount, currencyCode) {
  return (
    amount !== null &&
    amount !== undefined &&
    currencyCode !== null &&
    currencyCode !== undefined
  );
}

/**
 * @param {object} input
 * @param {number|string|null} [input.overrideAmount] - rung 1
 * @param {string|null} [input.overrideCurrencyCode]
 * @param {number|string|null} [input.unitBaseAmount] - rung 2
 * @param {string|null} [input.unitBaseCurrencyCode]
 * @param {number|string|null} [input.listingBaseAmount] - rung 3
 * @param {string|null} [input.listingBaseCurrencyCode]
 * @returns {{amount: number|string, currencyCode: string}|null} the
 *   winning rung's price, or `null` if none of the three rungs has one.
 */
export function resolvePriceForDate({
  overrideAmount,
  overrideCurrencyCode,
  unitBaseAmount,
  unitBaseCurrencyCode,
  listingBaseAmount,
  listingBaseCurrencyCode,
}) {
  if (isResolved(overrideAmount, overrideCurrencyCode)) {
    return { amount: overrideAmount, currencyCode: overrideCurrencyCode };
  }
  if (isResolved(unitBaseAmount, unitBaseCurrencyCode)) {
    return { amount: unitBaseAmount, currencyCode: unitBaseCurrencyCode };
  }
  if (isResolved(listingBaseAmount, listingBaseCurrencyCode)) {
    return { amount: listingBaseAmount, currencyCode: listingBaseCurrencyCode };
  }
  return null;
}

export default { resolvePriceForDate };
