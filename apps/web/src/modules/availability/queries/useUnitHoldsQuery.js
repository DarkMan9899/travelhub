import { useQuery } from '@tanstack/react-query';
import { getUnitHolds } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `GET /availability/units/:id/holds?from&to` — active hold rows overlapping the span (Phase 17 Admin Inventory "Holds" tab). */
export function useUnitHoldsQuery(unitId, from, to) {
  return useQuery({
    queryKey: availabilityKeys.holds(unitId, from, to),
    queryFn: () => getUnitHolds(unitId, { from, to }).then((res) => res.data),
    enabled: Boolean(unitId && from && to),
    staleTime: 10_000,
  });
}

export default useUnitHoldsQuery;
