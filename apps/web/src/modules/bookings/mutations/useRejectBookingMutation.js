/**
 * `useRejectBookingMutation` — Phase 9 (Partner Dashboard): wraps
 * `POST /bookings/:id/reject` (mirrors `useCancelBookingMutation.js`'s
 * shape). Moves `PENDING_VENDOR` -> `REJECTED` and restores held capacity.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rejectBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export function useRejectBookingMutation(id) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason) => rejectBooking(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export default useRejectBookingMutation;
