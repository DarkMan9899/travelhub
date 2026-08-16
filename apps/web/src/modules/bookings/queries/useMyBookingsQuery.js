/**
 * `useMyBookingsQuery` — wraps `GET /bookings` (FRONTEND_ARCHITECTURE.md
 * §14: React Query owns everything that originates from the API).
 *
 * `useInfiniteQuery`, not `useQuery` + manual state — same cursor-based
 * pagination shape as `useSearchListingsQuery.js`. No filters are
 * accepted here: the "My Trips" list always defaults to the caller's own
 * bookings (no `partnerId`/`viewAll`), matching `bookingService.
 * listBookings`'s own default-to-self-service behavior.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listMyBookings } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

export const MY_BOOKINGS_LIMIT = 10;

export function useMyBookingsQuery() {
  return useInfiniteQuery({
    queryKey: bookingKeys.list({}),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listMyBookings({
        limit: MY_BOOKINGS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export default useMyBookingsQuery;
