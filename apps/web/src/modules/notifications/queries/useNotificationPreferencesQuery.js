/**
 * `useNotificationPreferencesQuery` — wraps `GET /notifications/preferences`
 * (FRONTEND_ARCHITECTURE.md §14). Powers `NotificationPreferencesSection`.
 */

import { useQuery } from '@tanstack/react-query';
import { listNotificationPreferences } from '../../../api/notifications.js';
import notificationKeys from '../constants/queryKeys.js';

export function useNotificationPreferencesQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: async () => {
      const { data } = await listNotificationPreferences();
      return data;
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export default useNotificationPreferencesQuery;
