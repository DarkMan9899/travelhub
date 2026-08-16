/**
 * `useBlackoutsQuery` — wraps `GET /availability/blackouts?listingId=`
 * (FRONTEND_ARCHITECTURE.md §14).
 */

import { useQuery } from '@tanstack/react-query';
import { listBlackouts } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

export function useBlackoutsQuery(listingId) {
  return useQuery({
    queryKey: availabilityKeys.blackouts(listingId),
    queryFn: async () => {
      const { data } = await listBlackouts(listingId);
      return data;
    },
    enabled: Boolean(listingId),
    staleTime: 60 * 1000,
  });
}

export default useBlackoutsQuery;
