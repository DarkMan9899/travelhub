/**
 * `useAdminBookingDetailQuery` — wraps `GET /bookings/:id`. Same
 * 404-masked visibility every caller of `getBooking` already gets;
 * `BookingService.getBooking` grants access via ownership, the listing's
 * partner, or `booking.view_all` — the last of which is what makes this
 * usable from the admin detail page for a booking the admin has no
 * ownership relation to.
 */

import { useQuery } from '@tanstack/react-query';
import { getBooking } from '../../../api/bookings.js';

export function useAdminBookingDetailQuery(bookingId) {
  return useQuery({
    queryKey: ['admin', 'bookings', bookingId],
    queryFn: () => getBooking(bookingId).then((response) => response.data),
    enabled: Boolean(bookingId),
  });
}

export default useAdminBookingDetailQuery;
