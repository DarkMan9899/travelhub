import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncInventoryConnectionNow } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `POST /inventory-connections/:id/sync` — "Sync now". Invalidates the connection, its sync-run history, and every open breakdown/ledger. */
export function useSyncInventoryConnectionMutation(partnerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => syncInventoryConnectionNow(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connections(partnerId),
      });
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connection(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connectionSyncRuns(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connectionConflicts(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: [...availabilityKeys.all, 'breakdown'],
      });
    },
  });
}

export default useSyncInventoryConnectionMutation;
