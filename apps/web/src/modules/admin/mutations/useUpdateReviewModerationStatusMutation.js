/**
 * `useUpdateReviewModerationStatusMutation` — wraps
 * `PATCH /reviews/admin/:id/moderation-status` (approve/reject/flag,
 * with optional notes).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateReviewModerationStatus } from '../../../api/reviews.js';

export function useUpdateReviewModerationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, notes }) =>
      updateReviewModerationStatus(id, status, notes),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reviews'],
        exact: false,
      });
    },
  });
}

export default useUpdateReviewModerationStatusMutation;
