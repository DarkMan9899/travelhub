/**
 * `useRemoveBookableUnitMediaMutation` — wraps
 * `DELETE /availability/units/:id/media/:mediaId` (Sprint C-1).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeBookableUnitMedia } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useRemoveBookableUnitMediaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mediaId }) => removeBookableUnitMedia(id, mediaId),
    onSuccess: (_response, { listingId }) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.units(listingId),
      });
    },
  });
}

export default useRemoveBookableUnitMediaMutation;
