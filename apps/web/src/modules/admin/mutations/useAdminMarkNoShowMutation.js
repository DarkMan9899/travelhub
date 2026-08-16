/**
 * `useAdminMarkNoShowMutation` — wraps `POST /bookings/:id/no-show`
 * from the admin surface.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markBookingNoShow } from '../../../api/bookings.js';

export function useAdminMarkNoShowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }) => markBookingNoShow(id),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'bookings'],
        exact: false,
      });
    },
  });
}

export default useAdminMarkNoShowMutation;
