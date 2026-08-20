import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePartnerApplication } from '../../../api/partners.js';
import onboardingKeys from '../constants/queryKeys.js';

export function useUpdateApplicationMutation(id) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => updatePartnerApplication(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
}

export default useUpdateApplicationMutation;
