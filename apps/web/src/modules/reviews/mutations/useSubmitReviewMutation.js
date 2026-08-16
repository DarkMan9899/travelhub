/**
 * `useSubmitReviewMutation` — wraps `POST /reviews`. Invalidates the
 * booking's own review query (flips the detail page's gate) and the
 * listing's review list/summary (so a freshly submitted review shows up
 * without a manual refresh).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitReview } from '../../../api/reviews.js';
import reviewKeys from '../constants/queryKeys.js';

export function useSubmitReviewMutation(bookingId, listingId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => submitReview({ bookingId, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.forBooking(bookingId),
      });
      queryClient.invalidateQueries({
        queryKey: reviewKeys.forListing(listingId),
      });
    },
  });
}

export default useSubmitReviewMutation;
