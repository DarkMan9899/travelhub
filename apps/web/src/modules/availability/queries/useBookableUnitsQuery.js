/**
 * `useBookableUnitsQuery` — wraps `GET /availability/units?listingId=`
 * (FRONTEND_ARCHITECTURE.md §14). `AvailabilityStep` reads this to know
 * whether the listing already has the >=1 bookable unit publish-
 * readiness requires, so it doesn't prompt to register a second one
 * needlessly when resuming a draft.
 */

import { useQuery } from '@tanstack/react-query';
import { listBookableUnits } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useBookableUnitsQuery(listingId) {
  return useQuery({
    queryKey: availabilityKeys.units(listingId),
    queryFn: async () => {
      const { data } = await listBookableUnits(listingId);
      return data;
    },
    enabled: Boolean(listingId),
    staleTime: 60 * 1000,
  });
}

export default useBookableUnitsQuery;
