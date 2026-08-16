/**
 * `useDeleteListingMutation` — Phase 9 (Partner Dashboard): wraps
 * `DELETE /listings/:id` (mirrors `useUnpublishListingMutation.js`'s shape).
 * No `detail(id)` invalidation — the listing is gone, not merely changed —
 * only the list-shaped caches a deleted row could still appear in.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useDeleteListingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: listingKeys.mines() });
    },
  });
}

export default useDeleteListingMutation;
