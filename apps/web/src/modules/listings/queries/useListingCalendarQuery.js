/**
 * `useListingCalendarQuery` — the explicit-unit, price-aware calendar
 * read `ListingReservationWidget` uses (Phase 7, Booking Flow) to disable
 * blocked days in its date picker and compute a client-side price
 * estimate. Distinct from `useListingAvailabilityQuery.js` (Phase 6's
 * read-only display query, which auto-resolves/falls back on an
 * ambiguous unit): once a customer has picked a concrete `unitId` via
 * `useListingBookableUnitsQuery`, there is nothing to disambiguate —
 * this hook always passes it through explicitly.
 */

import { useQuery } from '@tanstack/react-query';
import { getListingCalendar } from '../../../api/availability.js';
import listingKeys from '../constants/queryKeys.js';

export function useListingCalendarQuery(listingId, unitId, { from, to } = {}) {
  return useQuery({
    queryKey: listingKeys.calendar(listingId, unitId, from, to),
    queryFn: async () => {
      const { data } = await getListingCalendar(listingId, {
        from,
        to,
        unitId,
      });
      return data;
    },
    enabled:
      Boolean(listingId) && Boolean(unitId) && Boolean(from) && Boolean(to),
    staleTime: 30 * 1000,
  });
}

export default useListingCalendarQuery;
