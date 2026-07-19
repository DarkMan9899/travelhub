/**
 * Bookable unit type vocabulary — Sprint 9's Availability Foundation.
 * Mirrors the seeded `bookable_unit_types` table exactly
 * (seeds/001_lookups.js: HOTEL_ROOM, PROPERTY_UNIT, RESTAURANT_TABLE,
 * TOUR_DEPARTURE, VEHICLE). Pure domain lookup, reused by
 * `availabilityValidators.js`'s Zod enum rather than re-declared —
 * mirrors how `LISTING_STATUSES`/`SORT_KEYS` are reused elsewhere.
 *
 * No code among these five values fits an `ATTRACTION`-type listing —
 * that is a documented, intentional gap (see the Sprint 9 plan's
 * "Explicitly deferred" section), not an auto-mapping this file invents.
 */

export const BOOKABLE_UNIT_TYPES = Object.freeze([
  'HOTEL_ROOM',
  'PROPERTY_UNIT',
  'RESTAURANT_TABLE',
  'TOUR_DEPARTURE',
  'VEHICLE',
]);

export default { BOOKABLE_UNIT_TYPES };
