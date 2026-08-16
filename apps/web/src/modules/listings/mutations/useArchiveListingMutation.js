/**
 * `useArchiveListingMutation` — Phase 9 (Partner Dashboard): wraps
 * `POST /listings/:id/archive` (mirrors `useUnpublishListingMutation.js`
 * exactly). Also invalidates `listingKeys.mines()` alongside the existing
 * `detail`/`lists` invalidations, since the Listings Management table reads
 * through that key namespace, not the public `lists()` one — see
 * `queryKeys.js`'s own `mines()`/`mine()` header for why this must be the
 * bare prefix, not `mine()` called with no argument.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { archiveListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useArchiveListingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => archiveListing(id),
    onSuccess: (_response, id) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: listingKeys.mines() });
    },
  });
}

export default useArchiveListingMutation;
