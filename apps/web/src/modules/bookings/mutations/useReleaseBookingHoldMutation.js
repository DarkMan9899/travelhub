/**
 * `useReleaseBookingHoldMutation` — wraps `DELETE /booking-holds`
 * (FRONTEND_ARCHITECTURE.md §14.5). `BookingCheckoutPageContent`'s
 * "Cancel and release hold" action calls this so an abandoned checkout
 * frees the held capacity immediately rather than waiting out the
 * platform's 15-minute expiry sweep.
 */

import { useMutation } from '@tanstack/react-query';
import { releaseBookingHolds } from '../../../api/bookingHolds.js';

export function useReleaseBookingHoldMutation() {
  return useMutation({
    mutationFn: (holdIds) => releaseBookingHolds(holdIds),
  });
}

export default useReleaseBookingHoldMutation;
