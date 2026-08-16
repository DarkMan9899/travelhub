/**
 * `useUpdatePartnerModerationStatusMutation` — wraps
 * `PATCH /partners/admin/:id/moderation-status` (suspend/restore).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePartnerModerationStatus } from '../../../api/partners.js';

export function useUpdatePartnerModerationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }) => updatePartnerModerationStatus(id, status),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'partners'],
        exact: false,
      });
    },
  });
}

export default useUpdatePartnerModerationStatusMutation;
