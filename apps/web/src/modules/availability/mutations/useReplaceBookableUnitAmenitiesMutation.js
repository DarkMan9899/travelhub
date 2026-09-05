/**
 * `useReplaceBookableUnitAmenitiesMutation` — wraps
 * `PATCH /availability/units/:id/amenities` (Sprint C-1). Full replace —
 * the Partner submits the entire desired amenity-id set each time.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceBookableUnitAmenities } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useReplaceBookableUnitAmenitiesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amenityIds }) =>
      replaceBookableUnitAmenities(id, amenityIds),
    onSuccess: (_response, { listingId }) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.units(listingId),
      });
    },
  });
}

export default useReplaceBookableUnitAmenitiesMutation;
