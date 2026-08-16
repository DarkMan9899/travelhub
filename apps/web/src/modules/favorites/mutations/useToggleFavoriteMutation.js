/**
 * `useToggleFavoriteMutation` — wraps `POST /favorites` and
 * `DELETE /favorites/:listingId` behind one mutate call, since
 * `FavoriteButton` only ever needs "make it the opposite of what it is
 * now." Invalidates both the lightweight id list (`FavoriteButton`'s own
 * state everywhere it appears) and the full paginated list
 * (`FavoritesPageContent`).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addFavorite, removeFavorite } from '../../../api/favorites.js';
import favoriteKeys from '../constants/queryKeys.js';

export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listingId, isFavorited }) =>
      isFavorited ? removeFavorite(listingId) : addFavorite(listingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.ids() });
      queryClient.invalidateQueries({ queryKey: favoriteKeys.lists() });
    },
  });
}

export default useToggleFavoriteMutation;
