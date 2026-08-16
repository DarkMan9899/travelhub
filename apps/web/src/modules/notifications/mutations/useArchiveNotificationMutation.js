/**
 * `useArchiveNotificationMutation` — wraps `PATCH /notifications/:id/archive`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveNotification } from '../../../api/notifications.js';
import notificationKeys from '../constants/queryKeys.js';

export function useArchiveNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => archiveNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export default useArchiveNotificationMutation;
