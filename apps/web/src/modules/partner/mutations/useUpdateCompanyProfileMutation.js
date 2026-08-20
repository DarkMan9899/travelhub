import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMyCompanyProfile } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useUpdateCompanyProfileMutation(partnerId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => updateMyCompanyProfile(partnerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: partnerKeys.profile(partnerId),
      });
    },
  });
}

export default useUpdateCompanyProfileMutation;
