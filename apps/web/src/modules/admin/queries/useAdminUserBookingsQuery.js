/**
 * `useAdminUserBookingsQuery` — a single user's booking history, for the
 * User Management detail page. Calls the shared `GET /bookings`
 * endpoint directly (`listMyBookings` already forwards arbitrary params
 * to axios) with the admin-only `customerId` filter added in Stage 11.1
 * — not the `bookings` module's own hooks, which are shaped around "my
 * own bookings"/"this partner's bookings", not "an arbitrary customer's
 * bookings by id."
 */

import { useQuery } from '@tanstack/react-query';
import { listMyBookings } from '../../../api/bookings.js';

export function useAdminUserBookingsQuery(userId) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'bookings'],
    queryFn: async () => {
      const { data } = await listMyBookings({ customerId: userId, limit: 10 });
      return data;
    },
    enabled: Boolean(userId),
  });
}

export default useAdminUserBookingsQuery;
