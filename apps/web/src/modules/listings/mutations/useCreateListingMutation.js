/**
 * `useCreateListingMutation` — wraps `POST /listings`
 * (FRONTEND_ARCHITECTURE.md §14.5). `PartnerListingWizard` calls this
 * exactly once, on its Basic Information step, to obtain the real,
 * server-persisted `DRAFT` listing id every later step then PATCHes.
 *
 * `onSuccess` invalidates `listingKeys.lists()` — a partner's own listing
 * list (dashboard) may now include this draft — but not `detail(id)`,
 * since nothing could have cached a detail entry for an id that didn't
 * exist yet.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useCreateListingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createListing(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
    },
  });
}

export default useCreateListingMutation;
