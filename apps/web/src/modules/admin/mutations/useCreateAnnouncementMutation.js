/**
 * `useCreateAnnouncementMutation` — wraps `POST /notifications/announcements`.
 * Invalidates the caller's own notifications (an ADMIN/SUPER_ADMIN who
 * broadcasts to `{type: 'ALL'}` or a role that includes themselves would
 * otherwise see a stale unread count/list until their next poll).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAnnouncement } from '../../../api/admin.js';
import notificationKeys from '../../notifications/constants/queryKeys.js';

export function useCreateAnnouncementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createAnnouncement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export default useCreateAnnouncementMutation;
