import { useQuery } from '@tanstack/react-query';
import { getAdminInventoryConnectionsOverview } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/**
 * `GET /inventory-connections/admin/overview` — Admin Sprint 5. Every
 * active connection across every partner, ordered failing-first — the
 * one genuinely admin-wide inventory read this module offers (every
 * other list here requires a `partnerId`/`connectionId` already known).
 */
export function useAdminInventoryOverviewQuery() {
  return useQuery({
    queryKey: availabilityKeys.adminConnectionsOverview,
    queryFn: () =>
      getAdminInventoryConnectionsOverview().then((res) => res.data),
    staleTime: 10_000,
  });
}

export default useAdminInventoryOverviewQuery;
