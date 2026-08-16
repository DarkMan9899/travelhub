/**
 * `useUpdateNotificationPreferenceMutation` — wraps
 * `PATCH /notifications/preferences/:category`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateNotificationPreference } from '../../../api/notifications.js';
import notificationKeys from '../constants/queryKeys.js';

export function useUpdateNotificationPreferenceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ category, inAppEnabled, emailEnabled }) =>
      updateNotificationPreference(category, { inAppEnabled, emailEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationKeys.preferences(),
      });
    },
  });
}

export default useUpdateNotificationPreferenceMutation;
