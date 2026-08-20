/**
 * `useApplicationQuery` — `GET /partners/applications/:id`, owner-only
 * full detail (includes `review_note` if the admin sent one back for
 * NEEDS_CHANGES). Used by `PartnerApplicationPageContent` once the user
 * already has an application in progress.
 */

import { useQuery } from '@tanstack/react-query';
import { getPartnerApplication } from '../../../api/partners.js';
import onboardingKeys from '../constants/queryKeys.js';

export function useApplicationQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: onboardingKeys.application(id),
    queryFn: async () => {
      const { data } = await getPartnerApplication(id);
      return data;
    },
    enabled: enabled && Boolean(id),
    staleTime: 30 * 1000,
  });
}

export default useApplicationQuery;
