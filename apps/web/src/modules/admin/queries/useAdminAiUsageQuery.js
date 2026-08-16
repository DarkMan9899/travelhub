/**
 * `useAdminAiUsageQuery` — wraps `GET /ai/admin/usage` (Stage 15.6: Admin
 * AI). Short `staleTime` + refetch-on-focus, matching
 * `useAdminSystemHealthQuery`'s "an admin reopening this tab expects a
 * fresh read" precedent — usage stats are only useful when current.
 */

import { useQuery } from '@tanstack/react-query';
import { getAiUsage } from '../../../api/ai.js';

export function useAdminAiUsageQuery() {
  return useQuery({
    queryKey: ['admin', 'ai-usage'],
    queryFn: async () => {
      const { data } = await getAiUsage();
      return data;
    },
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export default useAdminAiUsageQuery;
