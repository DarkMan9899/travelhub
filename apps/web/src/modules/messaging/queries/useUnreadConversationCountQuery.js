/**
 * `useUnreadConversationCountQuery` — wraps
 * `GET /messaging/conversations/unread-count`. Polls every 30s via
 * `refetchInterval`, the exact idiom `useUnreadCountQuery.js`
 * (Phase 13) established for this codebase's first polling hook.
 * Disabled entirely for a logged-out visitor.
 */

import { useQuery } from '@tanstack/react-query';
import { getUnreadConversationCount } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

const POLL_INTERVAL_MS = 30 * 1000;

export function useUnreadConversationCountQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: messagingKeys.unreadCount(),
    queryFn: async () => {
      const { data } = await getUnreadConversationCount();
      return data.unread_count;
    },
    enabled,
    staleTime: 10 * 1000,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}

export default useUnreadConversationCountQuery;
