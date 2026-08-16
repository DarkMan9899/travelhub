/**
 * `useReplaceListingFaqsMutation` — wraps `PATCH /listings/:id/faqs`
 * (Phase 18). Full-replace: `ContentStep` always sends the complete
 * desired `faqs` array, never a delta.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceListingFaqs } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useReplaceListingFaqsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, faqs }) => replaceListingFaqs(id, faqs),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
  });
}

export default useReplaceListingFaqsMutation;
