/**
 * `useMarkNotificationReadMutation` — wraps `PATCH /notifications/:id/read`.
 * Invalidates the list(s) and the unread-count query on success — no
 * optimistic update, matching the established invalidate-on-success-only
 * convention (favorites/reviews mutations follow the same pattern).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markNotificationRead } from '../../../api/notifications.js';
import notificationKeys from '../constants/queryKeys.js';

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export default useMarkNotificationReadMutation;
