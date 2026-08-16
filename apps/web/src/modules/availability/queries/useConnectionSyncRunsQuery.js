import { useQuery } from '@tanstack/react-query';
import { listInventoryConnectionSyncRuns } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `GET /inventory-connections/:id/sync-runs` — sync history (spec §28). */
export function useConnectionSyncRunsQuery(connectionId, options = {}) {
  return useQuery({
    queryKey: availabilityKeys.connectionSyncRuns(connectionId),
    queryFn: () =>
      listInventoryConnectionSyncRuns(connectionId).then((res) => res.data),
    enabled: Boolean(connectionId) && options.enabled !== false,
    staleTime: 5_000,
  });
}

export default useConnectionSyncRunsQuery;
