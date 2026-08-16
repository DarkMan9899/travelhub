/**
 * `useReviewForBookingQuery` — wraps `GET /reviews/booking/:bookingId`.
 * Powers `BookingDetailPageContent`'s "leave a review" gate: `null` data
 * means the booking hasn't been reviewed yet (show `ReviewForm`), a real
 * review means it has (show a read-only summary instead).
 */

import { useQuery } from '@tanstack/react-query';
import { getReviewForBooking } from '../../../api/reviews.js';
import reviewKeys from '../constants/queryKeys.js';

export function useReviewForBookingQuery(bookingId, { enabled = true } = {}) {
  return useQuery({
    queryKey: reviewKeys.forBooking(bookingId),
    queryFn: async () => {
      const { data } = await getReviewForBooking(bookingId);
      return data;
    },
    enabled: Boolean(bookingId) && enabled,
    staleTime: 30 * 1000,
  });
}

export default useReviewForBookingQuery;
