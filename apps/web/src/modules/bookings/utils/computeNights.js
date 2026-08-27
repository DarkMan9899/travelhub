/**
 * P2.2E — booking-detail nights computation, shared by the customer/
 * partner/admin booking-detail pages (all three render the same
 * `booking.items[]` shape from `bookingDto.js`).
 *
 * `booking_items.date_from`/`date_to` are always the guest's raw
 * requested check-in/checkout dates (`bookingService.js#resolveItem`
 * persists `firstHold.dateFrom`/`dateTo` verbatim, never the
 * checkout-exclusive-adjusted `consumedRange`) — for an accommodation
 * unit type those are already checkout-exclusive by definition (a guest
 * checking in Aug 10 and out Aug 13 stays 3 nights), so the day-count
 * between them IS the night count; no further adjustment via
 * `resolveConsumedRange` is needed here. "Nights" is a concept that only
 * applies to lodging — `isAccommodationUnitType` gates it so a tour/
 * vehicle/table booking never shows a meaningless night count.
 */

import { isAccommodationUnitType } from '../../listings/utils/accommodationDateSemantics.js';

export function computeNights(item) {
  if (!isAccommodationUnitType(item.bookable_unit_type)) return null;
  if (!item.date_from || !item.date_to) return null;
  const nights = Math.round(
    (new Date(item.date_to) - new Date(item.date_from)) / 86_400_000,
  );
  return nights > 0 ? nights : null;
}

export default computeNights;
