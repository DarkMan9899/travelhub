/**
 * `useAdminDashboardQuery` — wraps `GET /admin/dashboard`
 * (FRONTEND_ARCHITECTURE.md §14). This module's first query.
 * `staleTime` is short (30s) unlike most reference-data queries in this
 * app — dashboard metrics (pending counts, recent activity) are exactly
 * the kind of number an admin expects to be close to live.
 */

import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../../api/admin.js';

export function useAdminDashboardQuery() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await getDashboard();
      return data;
    },
    staleTime: 30 * 1000,
  });
}

export default useAdminDashboardQuery;
