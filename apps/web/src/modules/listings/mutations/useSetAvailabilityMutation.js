/**
 * `useSetAvailabilityMutation` — Phase 9 (Partner Dashboard): wraps
 * `POST /availability` (the day-range calendar write, `api/availability.js`'s
 * `setAvailability`). Lives here, not `modules/availability/`, for the same
 * reason `useListingCalendarQuery.js` does — `listingKeys.calendar` is a
 * listings-owned key and `listings` may depend on `availability`
 * (FRONTEND_ARCHITECTURE.md §6.3), never the reverse, so the mutation that
 * needs to invalidate that key belongs on this side of the boundary.
 *
 * Invalidates every cached calendar page for the listing (partial-key
 * match — `listingKeys.calendar(listingId, unitId, from, to)`'s trailing
 * `{unitId, from, to}` segment is intentionally omitted here), since a
 * single day-range write can affect more than one previously-fetched
 * window.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setAvailability } from '../../../api/availability.js';
import listingKeys from '../constants/queryKeys.js';

export function useSetAvailabilityMutation(listingId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => setAvailability(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...listingKeys.details(), listingId, 'calendar'],
      });
    },
  });
}

export default useSetAvailabilityMutation;
