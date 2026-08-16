/**
 * `useConversationsQuery` — wraps `GET /messaging/conversations`
 * (FRONTEND_ARCHITECTURE.md §14). `useInfiniteQuery`, forward cursor,
 * "Load more" — this is the conversation LIST, not a chat thread, so it
 * keeps the same forward-pagination direction every other list in this
 * codebase uses (`useNotificationsQuery`/`useFavoritesQuery`).
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listConversations } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export const CONVERSATIONS_LIMIT = 20;

export function useConversationsQuery({
  status,
  search,
  limit = CONVERSATIONS_LIMIT,
} = {}) {
  const filters = { status, search, limit };
  return useInfiniteQuery({
    queryKey: messagingKeys.conversations(filters),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listConversations({
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

export default useConversationsQuery;
