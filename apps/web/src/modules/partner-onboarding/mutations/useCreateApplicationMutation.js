import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPartnerApplication } from '../../../api/partners.js';
import onboardingKeys from '../constants/queryKeys.js';

export function useCreateApplicationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => createPartnerApplication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
}

export default useCreateApplicationMutation;
