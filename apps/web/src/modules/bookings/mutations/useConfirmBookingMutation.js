/**
 * `useConfirmBookingMutation` — Phase 9 (Partner Dashboard): wraps
 * `POST /bookings/:id/confirm` (mirrors `useCancelBookingMutation.js`'s
 * shape). Moves `PENDING_VENDOR` -> `CONFIRMED`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export function useConfirmBookingMutation(id) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => confirmBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
    },
  });
}

export default useConfirmBookingMutation;
