/**
 * `useAdminRejectBookingMutation` — wraps `POST /bookings/:id/reject`
 * (`{ reason? }`) from the admin surface.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rejectBooking } from '../../../api/bookings.js';

export function useAdminRejectBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => rejectBooking(id, reason),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'bookings'],
        exact: false,
      });
    },
  });
}

export default useAdminRejectBookingMutation;
