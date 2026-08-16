/**
 * `useListingDayStatusQuery` — Phase 18 (Premium Listing Detail,
 * Availability UX fix). Wraps `GET /availability/:listingId/day-status`,
 * the authoritative per-day read `ListingReservationWidget` uses to decide
 * which `DatePicker` days are selectable — see `api/availability.js`'s
 * `getListingDayStatus` header for exactly why `useListingCalendarQuery`
 * alone was blind to manual blocks / external reservations that reduced
 * `quantity_available` without flipping `availability_calendar.status_id`.
 */

import { useQuery } from '@tanstack/react-query';
import { getListingDayStatus } from '../../../api/availability.js';
import listingKeys from '../constants/queryKeys.js';

export function useListingDayStatusQuery(listingId, unitId, { from, to } = {}) {
  return useQuery({
    queryKey: listingKeys.dayStatus(listingId, unitId, from, to),
    queryFn: async () => {
      const { data } = await getListingDayStatus(listingId, {
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

export default useListingDayStatusQuery;
