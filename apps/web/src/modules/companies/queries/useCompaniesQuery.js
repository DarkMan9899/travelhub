/**
 * `useCompaniesQuery` — wraps `GET /partners` (FRONTEND_ARCHITECTURE.md
 * §14: React Query owns everything that originates from the API).
 *
 * `useInfiniteQuery`, mirroring `modules/search/queries/
 * useSearchListingsQuery.js` exactly — the backend's own pagination is
 * already cursor-based (`meta.next_cursor`/`meta.has_more`), which is
 * exactly the shape `getNextPageParam` expects.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { getPartners } from '../../../api/partners.js';
import companyKeys from '../constants/queryKeys.js';

export const COMPANIES_PAGE_LIMIT = 12;

export function useCompaniesQuery() {
  return useInfiniteQuery({
    queryKey: companyKeys.list(),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await getPartners({
        limit: COMPANIES_PAGE_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export default useCompaniesQuery;
