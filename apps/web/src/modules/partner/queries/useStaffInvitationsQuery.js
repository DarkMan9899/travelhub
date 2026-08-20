/** P1.4 (Master Roadmap) — `GET /partners/:id/staff/invitations`, pending invites only. */

import { useQuery } from '@tanstack/react-query';
import { getPartnerStaffInvitations } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useStaffInvitationsQuery(partnerId, { enabled = true } = {}) {
  return useQuery({
    queryKey: partnerKeys.staffInvitations(partnerId),
    queryFn: async () => {
      const { data } = await getPartnerStaffInvitations(partnerId);
      return data;
    },
    enabled: enabled && Boolean(partnerId),
  });
}

export default useStaffInvitationsQuery;
