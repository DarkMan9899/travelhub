/**
 * `useReplaceListingIncludedItemsMutation` — wraps `PATCH
 * /listings/:id/included-items` (Phase 18). Full-replace: `ContentStep`
 * always sends the complete desired `items` array, never a delta.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceListingIncludedItems } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useReplaceListingIncludedItemsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, items, languageCode }) =>
      replaceListingIncludedItems(id, items, languageCode),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
  });
}

export default useReplaceListingIncludedItemsMutation;
