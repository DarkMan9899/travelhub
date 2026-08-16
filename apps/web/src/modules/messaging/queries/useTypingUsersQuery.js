/**
 * `useTypingUsersQuery` — wraps `GET /messaging/conversations/:id/typing`.
 * Polls every 3s, matching the ephemeral, short-TTL (6s) nature of the
 * backend's Redis-only typing keys — a faster interval than
 * `useUnreadConversationCountQuery`'s 30s since this only runs while a
 * thread is actually open (`enabled`), never in the background.
 */

import { useQuery } from '@tanstack/react-query';
import { listTypingUsers } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

const POLL_INTERVAL_MS = 3 * 1000;

export function useTypingUsersQuery(conversationId, { enabled = true } = {}) {
  const isActive = enabled && Boolean(conversationId);
  return useQuery({
    queryKey: messagingKeys.typingUsers(conversationId),
    queryFn: async () => {
      const { data } = await listTypingUsers(conversationId);
      return data.typing_user_ids;
    },
    enabled: isActive,
    refetchInterval: isActive ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}

export default useTypingUsersQuery;
