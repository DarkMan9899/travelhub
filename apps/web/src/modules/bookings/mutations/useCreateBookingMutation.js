/**
 * `useCreateBookingMutation` — wraps `POST /bookings`
 * (FRONTEND_ARCHITECTURE.md §14.5). `BookingCheckoutPageContent` calls
 * this on "Confirm Booking Request", converting the active hold(s) into
 * a real, `PENDING_VENDOR` booking.
 *
 * `onSuccess` invalidates `bookingKeys.lists()` — the caller's "My Trips"
 * list may now include this booking.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export function useCreateBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createBooking(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export default useCreateBookingMutation;
