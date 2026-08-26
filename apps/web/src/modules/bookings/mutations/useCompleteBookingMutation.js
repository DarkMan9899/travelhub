/**
 * `useCompleteBookingMutation` — wraps `POST /bookings/:id/complete`
 * (mirrors `useConfirmBookingMutation.js`'s shape). Moves `CONFIRMED` ->
 * `COMPLETED`. Backend authorizes a partner owner for this exactly like
 * Confirm/Reject/Cancel (same `CONFIRM_PERMISSION`, verified by P2.2C's
 * preflight) — this hook exists so the Partner surface can call the same
 * already-authorized endpoint the admin surface already does via
 * `useAdminCompleteBookingMutation`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export function useCompleteBookingMutation(id) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => completeBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export default useCompleteBookingMutation;
