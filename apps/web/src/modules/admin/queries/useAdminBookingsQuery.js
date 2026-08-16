/**
 * `useAdminBookingsQuery` — wraps `GET /bookings?viewAll=true` (Stage
 * 11.4: Booking Operations), cursor-paginated the same way every other
 * admin list in this app is (`useInfiniteQuery` + "Load more"). Reuses
 * the existing `listMyBookings` client — `viewAll=true` is the flag
 * `BookingService.listBookings` already checks for `booking.view_all`
 * platform-wide visibility (Phase 9), just never exercised from an admin
 * list page until now.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listMyBookings } from '../../../api/bookings.js';

export const ADMIN_BOOKINGS_LIMIT = 20;

export function useAdminBookingsQuery({ status } = {}) {
  return useInfiniteQuery({
    queryKey: ['admin', 'bookings', { status }],
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listMyBookings({
        viewAll: true,
        status: status || undefined,
        limit: ADMIN_BOOKINGS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export default useAdminBookingsQuery;
