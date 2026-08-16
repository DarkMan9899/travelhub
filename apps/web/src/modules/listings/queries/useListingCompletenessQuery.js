/**
 * `useListingCompletenessQuery` — wraps `GET /listings/:id/completeness`
 * (Phase 18). Backs the Review step's completeness widget: a weighted
 * publish-readiness score plus the specific missing required/recommended
 * fields, computed server-side in `listingService.getListingCompleteness`
 * (never duplicated client-side — the wizard has no independent notion of
 * "what's required," only the server does, since required attributes/
 * policies are category-metadata-driven).
 */

import { useQuery } from '@tanstack/react-query';
import { getListingCompleteness } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useListingCompletenessQuery(listingId) {
  return useQuery({
    queryKey: listingKeys.completeness(listingId),
    queryFn: async () => {
      const { data } = await getListingCompleteness(listingId);
      return data;
    },
    enabled: Boolean(listingId),
  });
}

export default useListingCompletenessQuery;
