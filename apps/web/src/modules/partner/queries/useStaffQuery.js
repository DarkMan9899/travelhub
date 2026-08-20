/** P1.4 (Master Roadmap) — `GET /partners/:id/staff`, the active roster. */

import { useQuery } from '@tanstack/react-query';
import { getPartnerStaff } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useStaffQuery(partnerId, { enabled = true } = {}) {
  return useQuery({
    queryKey: partnerKeys.staff(partnerId),
    queryFn: async () => {
      const { data } = await getPartnerStaff(partnerId);
      return data;
    },
    enabled: enabled && Boolean(partnerId),
  });
}

export default useStaffQuery;
