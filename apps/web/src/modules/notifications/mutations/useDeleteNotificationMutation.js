/**
 * `useDeleteNotificationMutation` — wraps `DELETE /notifications/:id`
 * (soft delete server-side).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteNotification } from '../../../api/notifications.js';
import notificationKeys from '../constants/queryKeys.js';

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export default useDeleteNotificationMutation;
