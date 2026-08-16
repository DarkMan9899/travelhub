/**
 * `useUnreadCountQuery` — wraps `GET /notifications/unread-count`
 * (FRONTEND_ARCHITECTURE.md §14). Polls every 30s via `refetchInterval` —
 * the "acceptable to use polling for now if WebSockets are not yet
 * introduced" real-time-ready approach Phase 13's brief calls for; the
 * first instance of React-Query-driven polling in this codebase (no
 * existing precedent to mirror). Disabled entirely for a logged-out
 * visitor, same as `useFavoriteIdsQuery`.
 */

import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from '../../../api/notifications.js';
import notificationKeys from '../constants/queryKeys.js';

const POLL_INTERVAL_MS = 30 * 1000;

export function useUnreadCountQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const { data } = await getUnreadCount();
      return data.unread_count;
    },
    enabled,
    staleTime: 10 * 1000,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}

export default useUnreadCountQuery;
