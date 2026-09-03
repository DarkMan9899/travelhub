/**
 * `usePaymentsConfigQuery` — wraps `GET /payments/config` (public,
 * unauthenticated). Mirrors `usePaymentQuery`'s exact shape. Long
 * `staleTime`: whether payments are enabled is a deploy-time toggle, not
 * something that changes moment to moment, so this is intentionally not
 * refetched aggressively.
 */

import { useQuery } from '@tanstack/react-query';
import { getPaymentsConfig } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

export function usePaymentsConfigQuery() {
  return useQuery({
    queryKey: paymentKeys.config(),
    queryFn: async () => {
      const { data } = await getPaymentsConfig();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default usePaymentsConfigQuery;
