/**
 * `usePaymentQuery` — wraps `GET /payments/:id` (FRONTEND_ARCHITECTURE.md
 * §14). Mirrors `useBookingQuery`'s exact shape.
 */

import { useQuery } from '@tanstack/react-query';
import { getPayment } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

export function usePaymentQuery(id) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: async () => {
      const { data } = await getPayment(id);
      return data;
    },
    enabled: Boolean(id),
    staleTime: 15 * 1000,
  });
}

export default usePaymentQuery;
