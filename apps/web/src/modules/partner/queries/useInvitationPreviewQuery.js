/**
 * P1.4 (Master Roadmap) — `GET /partners/invitations/:token`, the
 * unauthenticated preview shown on the accept-invitation page before (or
 * regardless of) the visitor being signed in.
 */

import { useQuery } from '@tanstack/react-query';
import { previewPartnerStaffInvitation } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useInvitationPreviewQuery(token) {
  return useQuery({
    queryKey: partnerKeys.invitationPreview(token),
    queryFn: async () => {
      const { data } = await previewPartnerStaffInvitation(token);
      return data;
    },
    enabled: Boolean(token),
    retry: false,
  });
}

export default useInvitationPreviewQuery;
