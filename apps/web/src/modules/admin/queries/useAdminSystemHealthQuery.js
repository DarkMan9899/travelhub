/**
 * `useAdminSystemHealthQuery` — wraps `GET /admin/system-health` (Stage
 * 11.8). Short `staleTime` and refetch-on-window-focus (unlike most
 * queries in this app) since infra status is only useful when current —
 * an admin reopening this tab expects a fresh probe, not a cached one.
 */

import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '../../../api/admin.js';

export function useAdminSystemHealthQuery() {
  return useQuery({
    queryKey: ['admin', 'system-health'],
    queryFn: async () => {
      const { data } = await getSystemHealth();
      return data;
    },
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export default useAdminSystemHealthQuery;
