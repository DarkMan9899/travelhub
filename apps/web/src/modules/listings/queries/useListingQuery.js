/**
 * `useListingQuery` — wraps `GET /listings/:id` (FRONTEND_ARCHITECTURE.md
 * §14). This is the single source `PartnerListingWizard` reads from when
 * resuming a draft
 * ("Continue Editing"), and the target every wizard mutation's
 * `onSuccess` invalidates via `listingKeys.detail(id)`.
 *
 * `enabled: Boolean(id)` — the wizard's very first step (Basic
 * Information, before `createListing` has run) has no id yet.
 *
 * `staleTime: 60s` matches §14.2's "Listing detail" cache class.
 */

import { useQuery } from '@tanstack/react-query';
import { getListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useListingQuery(id) {
  return useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: async () => {
      const { data } = await getListing(id);
      return data;
    },
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
}

export default useListingQuery;
