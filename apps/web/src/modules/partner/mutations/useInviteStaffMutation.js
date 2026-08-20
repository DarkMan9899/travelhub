import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invitePartnerStaff } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useInviteStaffMutation(partnerId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => invitePartnerStaff(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: partnerKeys.staffInvitations(partnerId),
      });
    },
  });
}

export default useInviteStaffMutation;
