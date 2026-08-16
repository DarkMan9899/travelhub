/**
 * `useFavoritesQuery` — wraps `GET /favorites` (FRONTEND_ARCHITECTURE.md
 * §14: React Query owns everything that originates from the API).
 * `useInfiniteQuery`, same cursor-based pagination shape as
 * `useMyBookingsQuery.js`. Powers `FavoritesPageContent`.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listFavorites } from '../../../api/favorites.js';
import favoriteKeys from '../constants/queryKeys.js';

export const FAVORITES_LIMIT = 12;

export function useFavoritesQuery() {
  return useInfiniteQuery({
    queryKey: favoriteKeys.lists(),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listFavorites({
        limit: FAVORITES_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export default useFavoritesQuery;
