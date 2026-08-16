/**
 * `useAdminBookingHistoryQuery` — wraps `GET /bookings/:id/history`
 * (Stage 11.4), the real `booking_status_history` timeline — the
 * previously write-only table's first read path.
 */

import { useQuery } from '@tanstack/react-query';
import { getBookingHistory } from '../../../api/bookings.js';

export function useAdminBookingHistoryQuery(bookingId) {
  return useQuery({
    queryKey: ['admin', 'bookings', bookingId, 'history'],
    queryFn: () =>
      getBookingHistory(bookingId).then((response) => response.data),
    enabled: Boolean(bookingId),
  });
}

export default useAdminBookingHistoryQuery;
