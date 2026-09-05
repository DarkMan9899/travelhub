/**
 * `useUpdateBookableUnitDescriptionMutation` — wraps
 * `PATCH /availability/units/:id/description` (Sprint C-1). Full-replace
 * per authoring locale, same shape as the Listings module's own
 * `useReplaceListingHighlightsMutation` family.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBookableUnitDescription } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useUpdateBookableUnitDescriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, description, languageCode }) =>
      updateBookableUnitDescription(id, description, languageCode),
    onSuccess: (_response, { listingId }) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.units(listingId),
      });
    },
  });
}

export default useUpdateBookableUnitDescriptionMutation;
