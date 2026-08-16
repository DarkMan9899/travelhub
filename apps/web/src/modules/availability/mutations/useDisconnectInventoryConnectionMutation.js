import { useMutation, useQueryClient } from '@tanstack/react-query';
import { disconnectInventoryConnection } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `DELETE /inventory-connections/:id`. */
export function useDisconnectInventoryConnectionMutation(partnerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => disconnectInventoryConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connections(partnerId),
      });
    },
  });
}

export default useDisconnectInventoryConnectionMutation;
