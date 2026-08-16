/**
 * `usePartnerBookingsQuery` — Phase 9 (Partner Dashboard): a partner's
 * bookings across their listings, optionally narrowed by status (e.g.
 * `PENDING_VENDOR` to find bookings needing action). Wraps `GET /bookings`
 * with `partnerId` set (`bookingService.listBookings`'s owner-or-
 * `booking.view_all` branch) — distinct from `useMyBookingsQuery`, which
 * always calls the caller-own-bookings branch and accepts no filters.
 *
 * Shares `bookingKeys.list(filters)` with the rest of the module, so any
 * mutation invalidating `bookingKeys.lists()` (confirm/reject/cancel) also
 * invalidates this list.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listMyBookings } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export const PARTNER_BOOKINGS_LIMIT = 10;

/**
 * @param {{ partnerId: number, status?: string }} filters
 */
export function usePartnerBookingsQuery({ partnerId, status } = {}) {
  return useInfiniteQuery({
    queryKey: bookingKeys.list({ partnerId, status }),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listMyBookings({
        partnerId,
        status: status || undefined,
        limit: PARTNER_BOOKINGS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    enabled: Boolean(partnerId),
    staleTime: 15 * 1000,
  });
}

export default usePartnerBookingsQuery;
