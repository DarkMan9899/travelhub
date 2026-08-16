/**
 * `useAdminUserPartnershipsQuery` — a single user's partner memberships,
 * for the User Management detail page.
 */

import { useQuery } from '@tanstack/react-query';
import { getPartnerMembershipsForUser } from '../../../api/partners.js';

export function useAdminUserPartnershipsQuery(userId) {
  return useQuery({
    queryKey: ['admin', 'users', userId, 'partnerships'],
    queryFn: async () => {
      const { data } = await getPartnerMembershipsForUser(userId);
      return data;
    },
    enabled: Boolean(userId),
  });
}

export default useAdminUserPartnershipsQuery;
