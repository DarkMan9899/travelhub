/**
 * `useUpdateListingModerationStatusMutation` — wraps
 * `PATCH /listings/admin/:id/moderation-status` (approve/reject/flag,
 * with optional notes).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateListingModerationStatus } from '../../../api/listings.js';

export function useUpdateListingModerationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, notes }) =>
      updateListingModerationStatus(id, status, notes),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'listings', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'listings'],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'audit-logs'],
        exact: false,
      });
    },
  });
}

export default useUpdateListingModerationStatusMutation;
