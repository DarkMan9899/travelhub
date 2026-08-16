/**
 * `useMyPaymentsQuery` — wraps `GET /payments` (FRONTEND_ARCHITECTURE.md
 * §14). `useInfiniteQuery`, cursor pagination — mirrors
 * `useMyBookingsQuery`'s exact shape. No filters accepted: the payment
 * history page always defaults to the caller's own payments.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listPayments } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

export const MY_PAYMENTS_LIMIT = 10;

export function useMyPaymentsQuery() {
  return useInfiniteQuery({
    queryKey: paymentKeys.list({}),
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listPayments({
        limit: MY_PAYMENTS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export default useMyPaymentsQuery;
