/**
 * `useSuggestionsQuery` — wraps `GET /search/suggestions`
 * (FRONTEND_ARCHITECTURE.md §14). `enabled` mirrors the backend's own
 * `SearchService.suggest`'s minimum query length (2 chars) so this never
 * fires a request the service would just discard — one wasted network
 * round trip avoided per keystroke below that length, not merely a
 * cosmetic guard.
 */

import { useQuery } from '@tanstack/react-query';
import { getSuggestions } from '../../../api/search.js';
import searchKeys from '../constants/queryKeys.js';

const SUGGESTION_MIN_QUERY_LENGTH = 2;

export function useSuggestionsQuery(query, { locale } = {}) {
  const trimmed = query?.trim() ?? '';

  return useQuery({
    queryKey: searchKeys.suggestions(trimmed),
    queryFn: async () => {
      const { data } = await getSuggestions({ q: trimmed, locale });
      return data;
    },
    enabled: trimmed.length >= SUGGESTION_MIN_QUERY_LENGTH,
    staleTime: 30 * 1000,
  });
}

export default useSuggestionsQuery;
