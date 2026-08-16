/**
 * `usePartnerAiUsageQuery` — wraps `GET /ai/partner/usage` (Phase 15 "AI
 * Polish" sprint). Mirrors `useAdminAiUsageQuery`'s short `staleTime` +
 * refetch-on-focus precedent ("a partner reopening this tab expects a
 * fresh read"). Disabled until a real `partnerId` is known (the active
 * partnership from `usePartnerContext`) — never fired with an undefined id.
 */

import { useQuery } from '@tanstack/react-query';
import { getPartnerAiUsage } from '../../../api/ai.js';

export function usePartnerAiUsageQuery(partnerId) {
  return useQuery({
    queryKey: ['ai', 'partner-usage', partnerId],
    queryFn: async () => {
      const { data } = await getPartnerAiUsage(partnerId);
      return data;
    },
    enabled: Boolean(partnerId),
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
  });
}

export default usePartnerAiUsageQuery;
