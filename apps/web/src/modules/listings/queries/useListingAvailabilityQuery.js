/**
 * `useListingAvailabilityQuery` — wraps the two public availability reads
 * (FRONTEND_ARCHITECTURE.md §14: React Query owns everything that
 * originates from the API) for `ListingAvailabilitySection` (Phase 6).
 *
 * Requests a 30-day calendar window starting today. A listing with more
 * than one bookable unit has no public way to disambiguate which unit's
 * calendar to show (`GET /availability/:listingId/calendar` throws a 422
 * `AMBIGUOUS_UNIT` in that case — see `api/availability.js`'s header) —
 * this hook catches exactly that error and falls back to the
 * unit-independent blackout-ranges view, so the section always has
 * something meaningful to render instead of surfacing an error for what
 * is, from a visitor's perspective, a perfectly normal listing.
 */

import { useQuery } from '@tanstack/react-query';
import {
  getListingCalendar,
  getListingPublicRanges,
} from '../../../api/availability.js';
import listingKeys from '../constants/queryKeys.js';

const CALENDAR_WINDOW_DAYS = 30;

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function isAmbiguousUnitError(error) {
  return (
    error?.code === 'VALIDATION_FAILED' &&
    Array.isArray(error?.details) &&
    error.details.some((detail) => detail.issue === 'AMBIGUOUS_UNIT')
  );
}

export function useListingAvailabilityQuery(listingId) {
  return useQuery({
    queryKey: listingKeys.availability(listingId),
    queryFn: async () => {
      const today = new Date();
      const from = toISODate(today);
      const to = toISODate(
        new Date(
          today.getTime() + (CALENDAR_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000,
        ),
      );

      try {
        const { data } = await getListingCalendar(listingId, { from, to });
        return { kind: 'calendar', days: data };
      } catch (error) {
        if (!isAmbiguousUnitError(error)) throw error;
        const { data } = await getListingPublicRanges(listingId);
        return { kind: 'ranges', ranges: data };
      }
    },
    enabled: Boolean(listingId),
    staleTime: 60 * 1000,
  });
}

export default useListingAvailabilityQuery;
