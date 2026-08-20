/**
 * `useAdminReviewsQuery` — wraps `GET /reviews/admin` (moderation
 * queue), cursor-paginated the same way every other admin list in this
 * app is (`useInfiniteQuery` + "Load more").
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { getAdminReviews } from '../../../api/reviews.js';

export const ADMIN_REVIEWS_LIMIT = 20;

export function useAdminReviewsQuery({ moderationStatus, hasReports } = {}) {
  return useInfiniteQuery({
    queryKey: ['admin', 'reviews', { moderationStatus, hasReports }],
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await getAdminReviews({
        moderationStatus: moderationStatus || undefined,
        // `false` is a real, distinct filter value here ("all reviews",
        // as opposed to omitting the param, which the backend also
        // treats as "all") — `??`, not `||`, so it's never dropped.
        hasReports: hasReports ?? undefined,
        limit: ADMIN_REVIEWS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export default useAdminReviewsQuery;
