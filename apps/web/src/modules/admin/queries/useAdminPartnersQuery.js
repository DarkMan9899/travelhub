/**
 * `useAdminPartnersQuery` — wraps `GET /partners/admin` (admin list),
 * cursor-paginated the same way every other admin list in this app is
 * (`useInfiniteQuery` + "Load more" — see `DataTable`'s own header
 * comment).
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { getAdminPartners } from '../../../api/partners.js';

export const ADMIN_PARTNERS_LIMIT = 20;

export function useAdminPartnersQuery({
  keyword,
  verificationStatus,
  moderationStatus,
} = {}) {
  return useInfiniteQuery({
    queryKey: [
      'admin',
      'partners',
      { keyword, verificationStatus, moderationStatus },
    ],
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await getAdminPartners({
        keyword: keyword || undefined,
        verificationStatus: verificationStatus || undefined,
        moderationStatus: moderationStatus || undefined,
        limit: ADMIN_PARTNERS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export default useAdminPartnersQuery;
