/**
 * `useListingBookableUnitsQuery` — wraps the Phase 7 public read
 * `GET /availability/:listingId/units` (FRONTEND_ARCHITECTURE.md §14).
 * `ListingReservationWidget` uses this to resolve which unit(s) a
 * customer can select before requesting a hold — a listing with zero
 * units has nothing bookable yet (the widget falls back to an honest
 * "not bookable yet" state); exactly one unit is auto-selected; more
 * than one requires the customer to pick.
 */

import { useQuery } from '@tanstack/react-query';
import { getListingBookableUnits } from '../../../api/availability.js';
import listingKeys from '../constants/queryKeys.js';

export function useListingBookableUnitsQuery(listingId) {
  return useQuery({
    queryKey: listingKeys.bookableUnits(listingId),
    queryFn: async () => {
      const { data } = await getListingBookableUnits(listingId);
      return data;
    },
    enabled: Boolean(listingId),
    staleTime: 60 * 1000,
  });
}

export default useListingBookableUnitsQuery;
