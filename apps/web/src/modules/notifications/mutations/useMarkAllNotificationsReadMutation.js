/**
 * `useMarkAllNotificationsReadMutation` — wraps `POST /notifications/read-all`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markAllNotificationsRead } from '../../../api/notifications.js';
import notificationKeys from '../constants/queryKeys.js';

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export default useMarkAllNotificationsReadMutation;
