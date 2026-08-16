/**
 * `useAdminCompleteBookingMutation` — wraps `POST /bookings/:id/complete`
 * from the admin surface.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeBooking } from '../../../api/bookings.js';

export function useAdminCompleteBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }) => completeBooking(id),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'bookings'],
        exact: false,
      });
    },
  });
}

export default useAdminCompleteBookingMutation;
