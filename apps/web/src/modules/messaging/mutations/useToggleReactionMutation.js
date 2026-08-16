/**
 * `useToggleReactionMutation` — wraps
 * `POST /messaging/conversations/:id/messages/:messageId/reactions`.
 * Only the affected conversation's message list needs to be
 * invalidated — a reaction never changes the conversation list preview
 * or unread count.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleMessageReaction } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export function useToggleReactionMutation(conversationId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, reactionCode }) =>
      toggleMessageReaction(conversationId, messageId, reactionCode),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messagingKeys.messages(conversationId),
      });
    },
  });
}

export default useToggleReactionMutation;
