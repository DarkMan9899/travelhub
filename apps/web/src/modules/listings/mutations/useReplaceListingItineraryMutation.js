/**
 * `useReplaceListingItineraryMutation` — wraps `PATCH
 * /listings/:id/itinerary` (Phase 18). Full-replace: `ContentStep` always
 * sends the complete desired `steps` array, never a delta.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceListingItinerarySteps } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useReplaceListingItineraryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, steps, languageCode }) =>
      replaceListingItinerarySteps(id, steps, languageCode),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
  });
}

export default useReplaceListingItineraryMutation;
