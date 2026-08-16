import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateInventoryConnection } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `PATCH /inventory-connections/:id` — used for Pause/Resume (`status`) and config edits. */
export function useUpdateInventoryConnectionMutation(partnerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateInventoryConnection(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connections(partnerId),
      });
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connection(variables.id),
      });
    },
  });
}

export default useUpdateInventoryConnectionMutation;
