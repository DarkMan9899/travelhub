/**
 * `useCompanyQuery` — wraps `GET /partners/:slug` (FRONTEND_ARCHITECTURE.md
 * §14), mirroring `modules/listings/queries/useListingQuery.js`'s shape.
 * `enabled: Boolean(slug)` guards the brief window before the route
 * param resolves. `staleTime: 5 minutes` — a company profile changes far
 * less often than search/listing results.
 */

import { useQuery } from '@tanstack/react-query';
import { getPartnerBySlug } from '../../../api/partners.js';
import companyKeys from '../constants/queryKeys.js';

export function useCompanyQuery(slug) {
  return useQuery({
    queryKey: companyKeys.detail(slug),
    queryFn: async () => {
      const { data } = await getPartnerBySlug(slug);
      return data;
    },
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
}

export default useCompanyQuery;
