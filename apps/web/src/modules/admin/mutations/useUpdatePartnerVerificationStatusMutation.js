/**
 * `useUpdatePartnerVerificationStatusMutation` — wraps
 * `PATCH /partners/admin/:id/verification-status` (approve/reject/
 * request-changes). P1.2 (Master Roadmap): `reviewNote` is required by
 * the backend for NEEDS_CHANGES, optional for REJECTED, ignored for
 * APPROVED — see `updatePartnerVerificationStatus`'s own doc comment.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePartnerVerificationStatus } from '../../../api/partners.js';

export function useUpdatePartnerVerificationStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, reviewNote }) =>
      updatePartnerVerificationStatus(id, status, reviewNote),
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
