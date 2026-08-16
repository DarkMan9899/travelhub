/**
 * `useAdminConfirmBookingMutation` — wraps `POST /bookings/:id/confirm`
 * from the admin surface. Reuses the same endpoint Phase 9's Partner
 * Dashboard already calls — `BookingService.confirmBooking` grants
 * access via listing-partner ownership or `booking.confirm`, the latter
 * being what makes this callable for a booking the admin has no
 * ownership relation to.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmBooking } from '../../../api/bookings.js';

export function useAdminConfirmBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }) => confirmBooking(id),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'bookings'],
        exact: false,
      });
    },
  });
}

export default useAdminConfirmBookingMutation;
