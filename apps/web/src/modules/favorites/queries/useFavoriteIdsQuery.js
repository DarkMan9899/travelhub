/**
 * `useFavoriteIdsQuery` — wraps `GET /favorites/ids`
 * (FRONTEND_ARCHITECTURE.md §14: React Query owns everything that
 * originates from the API). A lightweight id list, not the full
 * listing-summary shape — hydrates `FavoriteButton`'s toggled state on
 * card grids (Home/Search/Listing Detail) without an N+1 per card.
 * Disabled entirely for a logged-out visitor (`enabled`) — favorites are
 * always the caller's own, and an unauthenticated `GET /favorites/ids`
 * would just 401.
 */

import { useQuery } from '@tanstack/react-query';
import { listFavoriteIds } from '../../../api/favorites.js';
import favoriteKeys from '../constants/queryKeys.js';

export function useFavoriteIdsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: favoriteKeys.ids(),
    queryFn: async () => {
      const { data } = await listFavoriteIds();
      return data;
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export default useFavoriteIdsQuery;
