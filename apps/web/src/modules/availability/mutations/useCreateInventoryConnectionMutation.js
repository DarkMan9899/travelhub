import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInventoryConnection } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `POST /inventory-connections` — configure a new Manual/iCal/CSV/API/Webhook connection (spec §15). */
export function useCreateInventoryConnectionMutation(partnerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createInventoryConnection(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connections(partnerId),
      });
    },
  });
}

export default useCreateInventoryConnectionMutation;
