/**
 * `useRemoveBlackoutMutation` — wraps `DELETE
 * /availability/blackouts/:id` (FRONTEND_ARCHITECTURE.md §14.5). Takes
 * `{ id, listingId }` — the endpoint itself only needs `id`, but
 * `listingId` is required to invalidate the right cached blackout list.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeBlackout } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useRemoveBlackoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }) => removeBlackout(id),
    onSuccess: (_response, { listingId }) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.blackouts(listingId),
      });
    },
  });
}

export default useRemoveBlackoutMutation;
