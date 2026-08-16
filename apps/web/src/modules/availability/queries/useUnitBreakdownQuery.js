import { useQuery } from '@tanstack/react-query';
import { getUnitBreakdown } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `GET /availability/units/:id/breakdown?from&to` — total/available/confirmed/held/external/manual per day. */
export function useUnitBreakdownQuery(unitId, from, to) {
  return useQuery({
    queryKey: availabilityKeys.breakdown(unitId, from, to),
    queryFn: () =>
      getUnitBreakdown(unitId, { from, to }).then((res) => res.data),
    enabled: Boolean(unitId && from && to),
    staleTime: 10_000,
  });
}

export default useUnitBreakdownQuery;
