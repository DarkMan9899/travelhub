/**
 * `useUnpublishListingMutation` — wraps `POST /listings/:id/unpublish`
 * (FRONTEND_ARCHITECTURE.md §14.5). Not part of the wizard flow itself,
 * but colocated with the other listing-lifecycle mutations for a
 * partner's "Continue Editing" / listing-management surface.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unpublishListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useUnpublishListingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => unpublishListing(id),
    onSuccess: (_response, id) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
      // Phase 9 (Partner Dashboard): the Listings Management table reads
      // through `mine()`, not the public `lists()` key. Must be the bare
      // `mines()` prefix, not `mine()` with no argument — see
      // `queryKeys.js`'s own header for why the latter silently fails to
      // match TanStack Query's partial-key invalidation.
      queryClient.invalidateQueries({ queryKey: listingKeys.mines() });
    },
  });
}

export default useUnpublishListingMutation;
