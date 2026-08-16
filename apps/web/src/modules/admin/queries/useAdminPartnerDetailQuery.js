/**
 * `useAdminPartnerDetailQuery` — wraps `GET /partners/admin/:id`
 * (admin detail).
 */

import { useQuery } from '@tanstack/react-query';
import { getAdminPartnerDetail } from '../../../api/partners.js';

export function useAdminPartnerDetailQuery(partnerId) {
  return useQuery({
    queryKey: ['admin', 'partners', partnerId],
    queryFn: async () => {
      const { data } = await getAdminPartnerDetail(partnerId);
      return data;
    },
    enabled: Boolean(partnerId),
  });
}

export default useAdminPartnerDetailQuery;
