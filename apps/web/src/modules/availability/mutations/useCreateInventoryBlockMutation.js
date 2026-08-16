import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInventoryBlock } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `POST /availability/blocks` — Quick Block (spec §11). Invalidates the listing's blocks list and every open breakdown/ledger view. */
export function useCreateInventoryBlockMutation(listingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createInventoryBlock(payload),
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

export default useCreateInventoryBlockMutation;
