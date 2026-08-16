/**
 * `usePublishListingMutation` — wraps `POST /listings/:id/publish`
 * (FRONTEND_ARCHITECTURE.md §14.5). Rejects with a 422 carrying an
 * itemized `details` array (`{ field, issue }[]`) until every
 * publish-readiness check passes — `ReviewStep` renders that array
 * directly as its inline validation summary, never re-deriving
 * readiness client-side.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { publishListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function usePublishListingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => publishListing(id),
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

export default usePublishListingMutation;
