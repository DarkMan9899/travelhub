/**
 * `useMarkNoShowMutation` — wraps `POST /bookings/:id/no-show` (mirrors
 * `useConfirmBookingMutation.js`'s shape). Moves `CONFIRMED` ->
 * `NO_SHOW`. Backend authorizes a partner owner for this exactly like
 * Confirm/Reject/Cancel (same `CONFIRM_PERMISSION`, verified by P2.2C's
 * preflight) — this hook exists so the Partner surface can call the same
 * already-authorized endpoint the admin surface already does via
 * `useAdminMarkNoShowMutation`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markBookingNoShow } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export function useMarkNoShowMutation(id) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markBookingNoShow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export default useMarkNoShowMutation;
