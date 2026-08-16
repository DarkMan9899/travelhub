import { useMutation, useQueryClient } from '@tanstack/react-query';
import { releaseInventoryBlock } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `DELETE /availability/blocks/:id` — Quick Unblock. */
export function useReleaseInventoryBlockMutation(listingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => releaseInventoryBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.blocks(listingId),
      });
      queryClient.invalidateQueries({
        queryKey: [...availabilityKeys.all, 'breakdown'],
      });
      queryClient.invalidateQueries({
        queryKey: [...availabilityKeys.all, 'ledger'],
      });
    },
  });
}

export default useReleaseInventoryBlockMutation;
