/**
 * `useMarkConversationReadMutation` — wraps
 * `PATCH /messaging/conversations/:id/read`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markConversationRead } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export function useMarkConversationReadMutation(conversationId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lastReadMessageId) =>
      markConversationRead(conversationId, lastReadMessageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
}

export default useMarkConversationReadMutation;
