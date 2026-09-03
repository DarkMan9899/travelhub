/**
 * `useReplaceListingHighlightsMutation` — wraps `PATCH
 * /listings/:id/highlights` (Phase 18). Full-replace: `ContentStep` always
 * sends the complete desired `highlights` array, never a delta.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceListingHighlights } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useReplaceListingHighlightsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, highlights, languageCode }) =>
      replaceListingHighlights(id, highlights, languageCode),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
  });
}

export default useReplaceListingHighlightsMutation;
