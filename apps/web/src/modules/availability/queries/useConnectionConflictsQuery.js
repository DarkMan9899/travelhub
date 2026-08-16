import { useQuery } from '@tanstack/react-query';
import { listInventoryConnectionConflicts } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `GET /inventory-connections/:id/conflicts` — unresolved sync conflicts (spec §26). */
export function useConnectionConflictsQuery(connectionId, options = {}) {
  return useQuery({
    queryKey: availabilityKeys.connectionConflicts(connectionId),
    queryFn: () =>
      listInventoryConnectionConflicts(connectionId).then((res) => res.data),
    enabled: Boolean(connectionId) && options.enabled !== false,
    staleTime: 5_000,
  });
}

export default useConnectionConflictsQuery;
