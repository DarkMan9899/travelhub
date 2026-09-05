/**
 * formatTimeRange — Marketplace Product Completeness Sprint A (Time-Aware
 * Booking Foundation). Shared by `ListingReservationWidget` (the
 * customer-facing time-slot picker), `BookingCheckoutPageContent`, and the
 * customer/partner/admin booking-detail pages — all five render the same
 * `HH:MM` strings the backend already trims `TIME` columns to (see
 * `mysqlBookableUnitRepository.js`/`mysqlBookingRepository.js`'s own
 * `toTimeString` helpers).
 *
 * Deliberately never constructs a `Date`/`Intl.DateTimeFormat` from these
 * strings: `time_slot_start`/`time_slot_end` are wall-clock times with no
 * associated date or timezone (BACKEND_ARCHITECTURE.md's `TIME` column
 * convention — see `availabilityValidators.js`'s own "display-only"
 * comment), so building a `Date` around them would force an arbitrary
 * timezone interpretation neither the partner who set them nor the
 * customer booking them ever specified. Plain string formatting exactly
 * matches this codebase's one other place a raw time is already shown
 * (check-in/check-out time on the public listing detail page).
 */

export function formatTimeRange(startTime, endTime) {
  if (!startTime) return null;
  if (!endTime) return startTime;
  return `${startTime}–${endTime}`;
}

export default formatTimeRange;
