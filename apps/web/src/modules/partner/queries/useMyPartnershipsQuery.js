/**
 * `useMyPartnershipsQuery` — wraps `GET /partners/mine`
 * (FRONTEND_ARCHITECTURE.md §14). This module's only query, and the sole
 * source `AuthProvider` reads from to populate `AuthContext`'s
 * `partnerships` field (bootstrapped alongside `GET /auth/me`) — every
 * other consumer (e.g. `RequirePartner`) reads `useAuth().partnerships`
 * rather than calling this hook a second time, per `AuthContext.jsx`'s
 * "populated exclusively by AuthProvider" rule. `enabled` defaults to
 * `true` but is overridable so `AuthProvider` can gate it on "is there
 * even a session yet" without this module depending on `auth`.
 *
 * `staleTime: 5 minutes` — low-frequency-change resource, same class as
 * `useCategoriesQuery`/`useSearchFilterDefinitionsQuery`.
 */

import { useQuery } from '@tanstack/react-query';
import { getMyPartnerships } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useMyPartnershipsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: partnerKeys.mine(),
    queryFn: async () => {
      const { data } = await getMyPartnerships();
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export default useMyPartnershipsQuery;
