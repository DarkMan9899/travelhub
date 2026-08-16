/**
 * `useCancelBookingMutation` — wraps `POST /bookings/:id/cancel`
 * (FRONTEND_ARCHITECTURE.md §14.5). `BookingDetailPageContent`'s Cancel
 * action calls this; the terminal status (`CANCELLED_BY_CUSTOMER`) is
 * resolved server-side from the caller's identity, never sent by this
 * mutation.
 *
 * `onSuccess` invalidates both this booking's own `detail(id)` entry
 * (its status just changed) and `lists()` (the "My Trips" list shows
 * status per row).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export function useCancelBookingMutation(id) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason) => cancelBooking(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export default useCancelBookingMutation;
