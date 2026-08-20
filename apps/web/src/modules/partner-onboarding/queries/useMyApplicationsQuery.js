/**
 * `useMyApplicationsQuery` — wraps `GET /partners/applications`
 * (unfiltered — see `constants/queryKeys.js`'s own comment). This is
 * what `BecomePartnerPageContent`'s CTA and the application page itself
 * use to discover "does this user already have one in progress" before
 * deciding whether to show a create form or the existing application's
 * status.
 */

import { useQuery } from '@tanstack/react-query';
import { getMyApplications } from '../../../api/partners.js';
import onboardingKeys from '../constants/queryKeys.js';

export function useMyApplicationsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: onboardingKeys.myApplications(),
    queryFn: async () => {
      const { data } = await getMyApplications();
      return data;
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export default useMyApplicationsQuery;
