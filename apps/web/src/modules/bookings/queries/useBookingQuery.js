/**
 * `useBookingQuery` — wraps `GET /bookings/:id` (FRONTEND_ARCHITECTURE.md
 * §14). The single source `BookingDetailPageContent` reads from, and the
 * target `useCancelBookingMutation`'s `onSuccess` invalidates.
 *
 * `enabled: Boolean(id)` — mirrors `useListingQuery`'s own guard.
 */

import { useQuery } from '@tanstack/react-query';
import { getBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export function useBookingQuery(id) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      const { data } = await getBooking(id);
      return data;
    },
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export default useBookingQuery;
