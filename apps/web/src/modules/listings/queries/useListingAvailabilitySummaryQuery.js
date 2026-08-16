/**
 * `useListingAvailabilitySummaryQuery` — Phase 17 (Listing Detail): wraps
 * the public, customer-safe `GET /availability/:listingId/availability-summary`
 * read. Same 30-day window convention as `useListingAvailabilityQuery`
 * (Phase 6), but this endpoint has no `AMBIGUOUS_UNIT` failure mode — it
 * returns one summary entry per bookable unit unconditionally, so there's
 * no fallback branch to handle here.
 */

import { useQuery } from '@tanstack/react-query';
import { getListingAvailabilitySummary } from '../../../api/availability.js';
import listingKeys from '../constants/queryKeys.js';

const SUMMARY_WINDOW_DAYS = 30;

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function useListingAvailabilitySummaryQuery(listingId) {
  return useQuery({
    queryKey: listingKeys.availabilitySummary(listingId),
    queryFn: async () => {
      const today = new Date();
      const from = toISODate(today);
      const to = toISODate(
        new Date(
          today.getTime() + (SUMMARY_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
        ),
      );
      const { data } = await getListingAvailabilitySummary(listingId, {
        from,
        to,
      });
      return data;
    },
    enabled: Boolean(listingId),
    staleTime: 60 * 1000,
  });
}

export default useListingAvailabilitySummaryQuery;
