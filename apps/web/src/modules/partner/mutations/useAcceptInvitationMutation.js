/**
 * P1.4 (Master Roadmap) — `POST /partners/invitations/:token/accept`. No
 * React Query cache to invalidate here — `partnerships` lives in
 * `AuthContext`, populated by `AuthProvider#hydrateFromMe`, not a query
 * key. The caller must invoke `useAuth().refreshUser()` after a
 * successful accept so `RequirePartner`/`PartnerLayout` see the new
 * membership on the very next render (see
 * `AcceptInvitationPageContent.jsx`).
 */

import { useMutation } from '@tanstack/react-query';
import { acceptPartnerStaffInvitation } from '../../../api/partners.js';

export function useAcceptInvitationMutation() {
  return useMutation({
    mutationFn: (token) => acceptPartnerStaffInvitation(token),
  });
}

export default useAcceptInvitationMutation;
