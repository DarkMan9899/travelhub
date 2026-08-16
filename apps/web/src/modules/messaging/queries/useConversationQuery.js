/**
 * `useConversationQuery` — wraps `GET /messaging/conversations/:id`
 * (single conversation detail: unread count, read cursor, archive state).
 */

import { useQuery } from '@tanstack/react-query';
import { getConversation } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export function useConversationQuery(conversationId, { enabled = true } = {}) {
  return useQuery({
    queryKey: messagingKeys.conversation(conversationId),
    queryFn: async () => {
      const { data } = await getConversation(conversationId);
      return data;
    },
    enabled: enabled && Boolean(conversationId),
    staleTime: 10 * 1000,
  });
}

export default useConversationQuery;
