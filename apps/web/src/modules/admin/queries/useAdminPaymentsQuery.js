/**
 * `useAdminPaymentsQuery` — wraps `GET /payments?viewAll=true`
 * (Phase 16: Admin payment management), same cursor-paginated
 * `useInfiniteQuery` + "Load more" shape every other admin list uses.
 * Reuses the existing `listPayments` client, matching how
 * `useAdminBookingsQuery` reuses `listMyBookings` with `viewAll: true`.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { listPayments } from '../../../api/payments.js';

export const ADMIN_PAYMENTS_LIMIT = 20;

export function useAdminPaymentsQuery({ status } = {}) {
  return useInfiniteQuery({
    queryKey: ['admin', 'payments', { status }],
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await listPayments({
        viewAll: true,
        status: status || undefined,
        limit: ADMIN_PAYMENTS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export default useAdminPaymentsQuery;
