import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setInventoryConnectionMapping } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `POST /inventory-connections/:id/mapping` — the external-resource-id -> Desavii-unit mapping UI (spec §18). */
export function useSetInventoryConnectionMappingMutation(partnerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) =>
      setInventoryConnectionMapping(id, payload),
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

export default useSetInventoryConnectionMappingMutation;
