import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveInventoryConnectionConflict } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `POST /inventory-connections/:id/conflicts/:conflictId/resolve`. */
export function useResolveConnectionConflictMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, conflictId, resolutionNote }) =>
      resolveInventoryConnectionConflict(id, conflictId, { resolutionNote }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.connectionConflicts(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.adminConflictsOverview,
      });
    },
  });
}

export default useResolveConnectionConflictMutation;
