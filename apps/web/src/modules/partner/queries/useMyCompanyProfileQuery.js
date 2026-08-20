/**
 * P1.3 (Master Roadmap) — `GET /partners/:id/profile`, the caller's own
 * company profile (owner/staff view — any status, not just APPROVED).
 */

import { useQuery } from '@tanstack/react-query';
import { getMyCompanyProfile } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useMyCompanyProfileQuery(partnerId, { enabled = true } = {}) {
  return useQuery({
    queryKey: partnerKeys.profile(partnerId),
    queryFn: async () => {
      const { data } = await getMyCompanyProfile(partnerId);
      return data;
    },
    enabled: enabled && Boolean(partnerId),
  });
}

export default useMyCompanyProfileQuery;
