/**
 * `useAttachBookableUnitMediaMutation` — wraps
 * `POST /availability/units/:id/media` (Sprint C-1: room photo gallery).
 * Mirrors `useAttachListingMediaMutation`'s exact shape.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachBookableUnitMedia } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useAttachBookableUnitMediaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }) => attachBookableUnitMedia(id, file),
    onSuccess: (_response, { listingId }) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.units(listingId),
      });
    },
  });
}

export default useAttachBookableUnitMediaMutation;
