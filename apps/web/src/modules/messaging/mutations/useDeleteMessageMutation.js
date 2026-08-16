/**
 * `useDeleteMessageMutation` — wraps
 * `DELETE /messaging/conversations/:id/messages/:messageId` (own message,
 * or `messaging.moderate`).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteMessage } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export function useDeleteMessageMutation(conversationId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId) => deleteMessage(conversationId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: messagingKeys.messages(conversationId),
      });
    },
  });
}

export default useDeleteMessageMutation;
