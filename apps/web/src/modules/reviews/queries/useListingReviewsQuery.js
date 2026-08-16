/**
 * `useListingReviewsQuery` — wraps `GET /reviews?listingId=`
 * (FRONTEND_ARCHITECTURE.md §14: React Query owns everything that
 * originates from the API). `useInfiniteQuery`, same cursor-based
 * pagination shape as `useMyBookingsQuery.js`.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listListingReviews } from '../../../api/reviews.js';
import reviewKeys from '../constants/queryKeys.js';

export const LISTING_REVIEWS_LIMIT = 10;

export function useListingReviewsQuery(listingId) {
  return useInfiniteQuery({
    queryKey: reviewKeys.forListing(listingId),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listListingReviews(listingId, {
        limit: LISTING_REVIEWS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    enabled: Boolean(listingId),
    staleTime: 60 * 1000,
  });
}

export default useListingReviewsQuery;
