/**
 * `useArchiveConversationMutation` — wraps
 * `PATCH /messaging/conversations/:id/archive` and `.../unarchive`, one
 * hook covering both directions via the `isArchived` argument (mirrors
 * how `useSetAvailabilityMutation` and similar toggle-style mutations in
 * this codebase take the target state as a call-time argument).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  archiveConversation,
  unarchiveConversation,
} from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export function useArchiveConversationMutation(conversationId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isArchived) =>
      isArchived
        ? archiveConversation(conversationId)
        : unarchiveConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.all });
    },
  });
}

export default useArchiveConversationMutation;
