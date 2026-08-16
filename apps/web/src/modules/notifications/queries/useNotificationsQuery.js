/**
 * `useNotificationsQuery` — wraps `GET /notifications`
 * (FRONTEND_ARCHITECTURE.md §14). `useInfiniteQuery`, same cursor-based
 * pagination shape as `useFavoritesQuery.js`. Powers both the dropdown
 * (small page, no filters) and `NotificationsPageContent` (full filters).
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listNotifications } from '../../../api/notifications.js';
import notificationKeys from '../constants/queryKeys.js';

export const NOTIFICATIONS_LIMIT = 20;

export function useNotificationsQuery({
  status,
  category,
  search,
  limit = NOTIFICATIONS_LIMIT,
} = {}) {
  const filters = { status, category, search, limit };
  return useInfiniteQuery({
    queryKey: notificationKeys.lists(filters),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listNotifications({
        ...filters,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 15 * 1000,
  });
}

export default useNotificationsQuery;
