/**
 * Static `bookable_unit_types.code` -> `booking_types.code` mapping —
 * Sprint 10 (Booking & Reservation Holds Foundation).
 *
 * `booking_type_id` is always derived server-side from the unit being
 * booked, never accepted from the client (BACKEND_ARCHITECTURE.md §13
 * "never trust client data"). Mirrors both lookup tables exactly as
 * seeded (`seeds/001_lookups.js`) — a booking type with no corresponding
 * unit type (none exist today) or vice versa is a deliberate, documented
 * gap, not something this map silently invents.
 *
 * Domain layer (`core` may depend only on `core`) — no database access.
 */

export const BOOKABLE_UNIT_TYPE_TO_BOOKING_TYPE = Object.freeze({
  HOTEL_ROOM: 'HOTEL_ROOM_BOOKING',
  PROPERTY_UNIT: 'PROPERTY_BOOKING',
  RESTAURANT_TABLE: 'RESTAURANT_RESERVATION',
  TOUR_DEPARTURE: 'TOUR_BOOKING',
  VEHICLE: 'CAR_RENTAL_BOOKING',
});

/**
 * @param {string} bookableUnitTypeCode
 * @returns {string} the corresponding `booking_types.code`
 */
export function resolveBookingTypeCode(bookableUnitTypeCode) {
  const bookingTypeCode =
    BOOKABLE_UNIT_TYPE_TO_BOOKING_TYPE[bookableUnitTypeCode];
  if (!bookingTypeCode) {
    throw new TypeError(
      `No booking type is mapped for bookable unit type "${bookableUnitTypeCode}".`,
    );
  }
  return bookingTypeCode;
}

export default { BOOKABLE_UNIT_TYPE_TO_BOOKING_TYPE, resolveBookingTypeCode };
