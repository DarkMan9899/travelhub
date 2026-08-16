/**
 * `useSendMessageMutation` — wraps
 * `POST /messaging/conversations/:id/messages`. Optimistic append is
 * deliberately NOT done (Phase 14 frontend design) — matches the
 * established invalidate-on-success-only convention rather than
 * introducing a new optimistic-update pattern into this codebase.
 * Invalidates the whole messaging cache since a send also changes the
 * conversation's preview/last-message-at and the unread count for other
 * participants (irrelevant to this client, but keeps the invalidation
 * rule simple and consistent with every other messaging mutation).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export function useSendMessageMutation(conversationId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => sendMessage(conversationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
}

export default useSendMessageMutation;
