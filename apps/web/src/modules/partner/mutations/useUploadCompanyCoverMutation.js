import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadCompanyCover } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useUploadCompanyCoverMutation(partnerId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file) => uploadCompanyCover(partnerId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: partnerKeys.profile(partnerId),
      });
    },
  });
}

export default useUploadCompanyCoverMutation;
