/**
 * `usePaymentsForBookingQuery` — wraps `GET /payments?bookingId=X`. The
 * booking detail pages (customer/partner/admin) use this to decide
 * between showing a "Pay Now" panel (no payments yet, or every existing
 * one is terminally FAILED/CANCELLED) or a payment-status summary (an
 * active or succeeded one exists) — called unconditionally per the Rules
 * of Hooks, same pattern `useReviewForBookingQuery` already establishes
 * in `BookingDetailPageContent`.
 */

import { useQuery } from '@tanstack/react-query';
import { listPayments } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

export function usePaymentsForBookingQuery(bookingId) {
  return useQuery({
    queryKey: paymentKeys.forBooking(bookingId),
    queryFn: async () => {
      const { data } = await listPayments({ bookingId, limit: 20 });
      return data;
    },
    enabled: Boolean(bookingId),
    staleTime: 10 * 1000,
  });
}

export default usePaymentsForBookingQuery;
