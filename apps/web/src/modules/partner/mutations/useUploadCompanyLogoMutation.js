import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadCompanyLogo } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useUploadCompanyLogoMutation(partnerId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file) => uploadCompanyLogo(partnerId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: partnerKeys.profile(partnerId),
      });
    },
  });
}

export default useUploadCompanyLogoMutation;
