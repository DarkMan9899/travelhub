/**
 * `useUpdateListingMutation` — wraps `PATCH /listings/:id`
 * (FRONTEND_ARCHITECTURE.md §14.5). Every step of `PartnerListingWizard`
 * after Basic Information calls this against the same listing id —
 * Location, Dynamic Attributes, Amenities, Pricing, Policies, and
 * Booking Rules are all just different `payload` shapes over this one
 * mutation, never separate endpoints.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateListing } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useUpdateListingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) => updateListing(id, payload),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
    },
  });
}

export default useUpdateListingMutation;
