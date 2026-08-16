/**
 * `useCreateBookingHoldMutation` — wraps `POST /booking-holds`
 * (FRONTEND_ARCHITECTURE.md §14.5). `ListingReservationWidget` calls this
 * when the customer clicks "Request to Book"; its response (`{items,
 * expires_at}`) is carried forward to `BookingCheckoutPageContent` via
 * router state, not cached — a hold has no list surface in this UI, so
 * there is nothing to invalidate.
 */

import { useMutation } from '@tanstack/react-query';
import { createBookingHolds } from '../../../api/bookingHolds.js';

export function useCreateBookingHoldMutation() {
  return useMutation({
    mutationFn: (items) => createBookingHolds(items),
  });
}

export default useCreateBookingHoldMutation;
