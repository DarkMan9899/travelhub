/**
 * `useCreateBlackoutMutation` — wraps `POST /availability/blackouts`
 * (FRONTEND_ARCHITECTURE.md §14.5).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBlackout } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useCreateBlackoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createBlackout(payload),
    onSuccess: (_response, { listingId }) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.blackouts(listingId),
      });
    },
  });
}

export default useCreateBlackoutMutation;
