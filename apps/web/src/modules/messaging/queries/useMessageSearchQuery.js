/**
 * `useMessageSearchQuery` — wraps `GET /messaging/messages/search?q=`.
 * A single page (not `useInfiniteQuery`) — matches how small, ad hoc
 * search results are treated elsewhere in this codebase; disabled until
 * the caller has a non-empty, already-debounced query string (the
 * `DestinationAutocomplete` debounce idiom is reused by the consuming
 * component, not duplicated here).
 */

import { useQuery } from '@tanstack/react-query';
import { searchMessages } from '../../../api/messaging.js';
import messagingKeys from '../constants/queryKeys.js';

export function useMessageSearchQuery(query, { limit = 20 } = {}) {
  const trimmed = query?.trim() ?? '';
  return useQuery({
    queryKey: messagingKeys.search(trimmed),
    queryFn: async () => {
      const { data } = await searchMessages({ q: trimmed, limit });
      return data;
    },
    enabled: trimmed.length > 0,
    staleTime: 5 * 1000,
  });
}

export default useMessageSearchQuery;
