/**
 * `useConversationMessagesQuery` — wraps
 * `GET /messaging/conversations/:id/messages`.
 *
 * Backward cursor (Phase 14 scope decision #10 — a deliberate fork from
 * every other list in this codebase, which paginates forward): the FIRST
 * page (no cursor) is the NEWEST batch of messages, already ordered
 * oldest-first WITHIN that page (the backend reverses the repository's
 * DESC page before responding). Calling `fetchNextPage` walks further
 * into the past, appending an OLDER page onto `data.pages`.
 *
 * To render a thread top-to-bottom (oldest overall at the top), a
 * consumer must flatten `data.pages` in REVERSE page order — the
 * last-fetched (oldest) page displays first — while keeping each page's
 * own internal oldest-first order intact:
 *
 *   [...data.pages].reverse().flatMap((page) => page.results)
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listMessages } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export const MESSAGES_LIMIT = 30;

export function useConversationMessagesQuery(
  conversationId,
  { limit = MESSAGES_LIMIT, enabled = true } = {},
) {
  return useInfiniteQuery({
    queryKey: messagingKeys.messages(conversationId),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listMessages(conversationId, {
        cursor: pageParam ?? undefined,
        limit,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    enabled: enabled && Boolean(conversationId),
    staleTime: 5 * 1000,
  });
}

export default useConversationMessagesQuery;
