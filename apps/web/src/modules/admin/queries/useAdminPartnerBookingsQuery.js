/**
 * `useAdminPartnerBookingsQuery` — a single partner's recent bookings,
 * for the Partner Management detail page. Calls the shared `GET
 * /bookings` endpoint directly with the already-existing `partnerId`
 * filter (`bookingService.listBookings` already grants owner-or-
 * `booking.view_all` access to it — an admin with `partner.verify`/
 * `partner.moderate` isn't automatically the owner, so this relies on
 * the admin roles' `booking.view_all` grant, same as
 * `useAdminUserBookingsQuery`'s `customerId` form).
 */

import { useQuery } from '@tanstack/react-query';
import { listMyBookings } from '../../../api/bookings.js';

export function useAdminPartnerBookingsQuery(partnerId) {
  return useQuery({
    queryKey: ['admin', 'partners', partnerId, 'bookings'],
    queryFn: async () => {
      const { data } = await listMyBookings({ partnerId, limit: 10 });
      return data;
    },
    enabled: Boolean(partnerId),
  });
}

export default useAdminPartnerBookingsQuery;
