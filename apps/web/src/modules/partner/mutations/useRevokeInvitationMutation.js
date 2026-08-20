import { useMutation, useQueryClient } from '@tanstack/react-query';
import { revokePartnerStaffInvitation } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useRevokeInvitationMutation(partnerId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId) =>
      revokePartnerStaffInvitation(partnerId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: partnerKeys.staffInvitations(partnerId),
      });
    },
  });
}

export default useRevokeInvitationMutation;
