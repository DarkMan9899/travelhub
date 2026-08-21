/** P1.5 (Master Roadmap) — `DELETE /reviews/:id/reply`. Invalidates the listing's reviews list so the removal appears immediately. */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReviewReply } from '../../../api/reviews.js';
import reviewKeys from '../constants/queryKeys.js';

export function useDeleteReviewReplyMutation(listingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => deleteReviewReply(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.forListing(listingId),
      });
    },
  });
}

export default useDeleteReviewReplyMutation;
