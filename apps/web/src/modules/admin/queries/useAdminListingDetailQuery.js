/**
 * `useAdminListingDetailQuery` — wraps `GET /listings/admin/:id`
 * (admin detail — bypasses the publish-visibility rule the public
 * `GET /listings/:id` enforces).
 */

import { useQuery } from '@tanstack/react-query';
import { getAdminListingDetail } from '../../../api/listings.js';

export function useAdminListingDetailQuery(listingId) {
  return useQuery({
    queryKey: ['admin', 'listings', listingId],
    queryFn: async () => {
      const { data } = await getAdminListingDetail(listingId);
      return data;
    },
    enabled: Boolean(listingId),
  });
}

export default useAdminListingDetailQuery;
