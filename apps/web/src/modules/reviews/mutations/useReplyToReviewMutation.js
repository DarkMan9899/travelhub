/** P1.5 (Master Roadmap) — `PUT /reviews/:id/reply`. Invalidates the listing's reviews list so the new reply appears immediately. */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replyToReview } from '../../../api/reviews.js';
import reviewKeys from '../constants/queryKeys.js';

export function useReplyToReviewMutation(listingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }) => replyToReview(id, response),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.forListing(listingId),
      });
    },
  });
}

export default useReplyToReviewMutation;
