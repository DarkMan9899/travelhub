import { useQuery } from '@tanstack/react-query';
import { getUnitLedger } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `GET /availability/units/:id/ledger?from&to` — the append-only "why is this unavailable" audit trail. */
export function useUnitLedgerQuery(unitId, from, to, options = {}) {
  return useQuery({
    queryKey: availabilityKeys.ledger(unitId, from, to),
    queryFn: () => getUnitLedger(unitId, { from, to }).then((res) => res.data),
    enabled: Boolean(unitId && from && to) && options.enabled !== false,
    staleTime: 10_000,
  });
}

export default useUnitLedgerQuery;
