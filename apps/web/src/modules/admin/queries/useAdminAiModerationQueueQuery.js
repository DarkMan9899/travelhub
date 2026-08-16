/**
 * `useAdminAiModerationQueueQuery` — wraps `GET /ai/admin/moderation-queue`
 * (Stage 15.6: Admin AI). Not paginated server-side beyond a fixed
 * `limit` — the queue is meant to be a small, actionable worklist, not a
 * full listing browser.
 */

import { useQuery } from '@tanstack/react-query';
import { getModerationQueue } from '../../../api/ai.js';

export function useAdminAiModerationQueueQuery() {
  return useQuery({
    queryKey: ['admin', 'ai-moderation-queue'],
    queryFn: async () => {
      const { data } = await getModerationQueue(50);
      return data.entries;
    },
    staleTime: 30 * 1000,
  });
}

export default useAdminAiModerationQueueQuery;
