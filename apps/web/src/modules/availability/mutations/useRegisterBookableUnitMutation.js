/**
 * `useRegisterBookableUnitMutation` — wraps `POST /availability/units`
 * (FRONTEND_ARCHITECTURE.md §14.5). `AvailabilityStep` calls this to
 * satisfy publish-readiness's >=1 bookable unit requirement.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerBookableUnit } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useRegisterBookableUnitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => registerBookableUnit(payload),
    onSuccess: (_response, { listingId }) => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.units(listingId),
      });
    },
  });
}

export default useRegisterBookableUnitMutation;
