/**
 * `useCreateConversationMutation` — wraps `POST /messaging/conversations`.
 * Invalidates every messaging query on success (list, unread-count) — no
 * optimistic update, matching the established invalidate-on-success-only
 * convention (`useMarkNotificationReadMutation` and friends).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createConversation } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export function useCreateConversationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createConversation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
}

export default useCreateConversationMutation;
