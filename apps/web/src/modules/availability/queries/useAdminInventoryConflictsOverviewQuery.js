import { useQuery } from '@tanstack/react-query';
import { getAdminInventoryConflictsOverview } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/**
 * `GET /inventory-connections/admin/conflicts` — Admin Sprint 5. Every
 * unresolved sync conflict across every connection, oldest first.
 */
export function useAdminInventoryConflictsOverviewQuery() {
  return useQuery({
    queryKey: availabilityKeys.adminConflictsOverview,
    queryFn: () => getAdminInventoryConflictsOverview().then((res) => res.data),
    staleTime: 10_000,
  });
}

export default useAdminInventoryConflictsOverviewQuery;
