/**
 * `useAdminCancelBookingMutation` — wraps `POST /bookings/:id/cancel`
 * (`{ reason? }`) from the admin surface. `BookingService.cancelBooking`
 * resolves the terminal status server-side from the caller's identity —
 * an admin acting via `booking.cancel_any` always produces
 * `CANCELLED_BY_VENDOR`, never `CANCELLED_BY_CUSTOMER`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelBooking } from '../../../api/bookings.js';

export function useAdminCancelBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => cancelBooking(id, reason),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'bookings'],
        exact: false,
      });
    },
  });
}

export default useAdminCancelBookingMutation;
