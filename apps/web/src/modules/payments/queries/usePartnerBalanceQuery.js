/**
 * `usePartnerBalanceQuery` — wraps `GET /payments/partners/:id/balance`.
 * Owner/staff of that partner, or `payment.view`.
 */

import { useQuery } from '@tanstack/react-query';
import { getPartnerBalance } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

export function usePartnerBalanceQuery(partnerId) {
  return useQuery({
    queryKey: paymentKeys.partnerBalance(partnerId),
    queryFn: async () => {
      const { data } = await getPartnerBalance(partnerId);
      return data;
    },
    enabled: Boolean(partnerId),
    staleTime: 30 * 1000,
  });
}

export default usePartnerBalanceQuery;
