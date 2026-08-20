import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitPartnerApplication } from '../../../api/partners.js';
import onboardingKeys from '../constants/queryKeys.js';

export function useSubmitApplicationMutation(id) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => submitPartnerApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
}

export default useSubmitApplicationMutation;
