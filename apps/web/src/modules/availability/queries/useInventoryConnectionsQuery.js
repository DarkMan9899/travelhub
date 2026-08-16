import { useQuery } from '@tanstack/react-query';
import { listInventoryConnections } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `GET /inventory-connections?partnerId=` — the Connections Center's list. */
export function useInventoryConnectionsQuery(partnerId) {
  return useQuery({
    queryKey: availabilityKeys.connections(partnerId),
    queryFn: () => listInventoryConnections(partnerId).then((res) => res.data),
    enabled: Boolean(partnerId),
    staleTime: 10_000,
  });
}

export default useInventoryConnectionsQuery;
