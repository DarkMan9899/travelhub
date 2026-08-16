/**
 * `useUpdatePartnerVerificationStatusMutation` — wraps
 * `PATCH /partners/admin/:id/verification-status` (approve/reject/reset).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePartnerVerificationStatus } from '../../../api/partners.js';

export function useUpdatePartnerVerificationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }) => updatePartnerVerificationStatus(id, status),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'partners', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'partners'],
        exact: false,
      });
    },
  });
}

export default useUpdatePartnerVerificationStatusMutation;
