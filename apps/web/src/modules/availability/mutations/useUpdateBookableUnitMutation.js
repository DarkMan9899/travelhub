/**
 * `useUpdateBookableUnitMutation` — wraps `PATCH /availability/units/:id`
 * (P2.2A). Used by `BookableUnitsManager` to edit an already-registered
 * unit's label/capacity/occupancy/bed configuration/base price.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBookableUnit } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useUpdateBookableUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) => updateBookableUnit(id, payload),
    onSuccess: (_response, { listingId }) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.units(listingId),
      });
    },
  });
}

export default useUpdateBookableUnitMutation;
