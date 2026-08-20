/**
 * `useSearchListingsQuery` — wraps `GET /search` (FRONTEND_ARCHITECTURE.md
 * §14: React Query owns everything that originates from the API).
 *
 * `useInfiniteQuery`, not `useQuery` + manual state: the backend's own
 * pagination is already cursor-based (`meta.next_cursor`/`meta.has_more`,
 * `infrastructure/database/pagination.js`), which is exactly the shape
 * `getNextPageParam` expects — no adapter needed. The search endpoint's
 * own DTO already returns everything a result card needs (`title`/
 * `summary`/`cover_image_url` pre-resolved server-side), so there is no
 * per-row follow-up call here.
 *
 * `staleTime: 60s` matches §14.2's "search results" cache class.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { searchListings } from '../../../api/search.js';
import searchKeys from '../constants/queryKeys.js';
import { toSearchQueryParams } from '../schemas/searchParams.js';

export const SEARCH_RESULTS_LIMIT = 12;

/**
 * @param {{ destination?: string, categoryId?: number, listingType?: string, sort?: string }} filters
 * @param {{ locale?: string }} [options]
 */
export function useSearchListingsQuery(filters, { locale } = {}) {
  const queryParams = toSearchQueryParams(filters, locale);

  return useInfiniteQuery({
    queryKey: searchKeys.results({ ...queryParams }),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await searchListings({
        ...queryParams,
        limit: SEARCH_RESULTS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 60 * 1000,
  });
}

export default useSearchListingsQuery;
