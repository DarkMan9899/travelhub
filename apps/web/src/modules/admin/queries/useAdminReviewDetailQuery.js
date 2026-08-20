/** `useAdminReviewDetailQuery` — wraps `GET /reviews/admin/:id` (full detail + reports), for the reports-inspection dialog. */

import { useQuery } from '@tanstack/react-query';
import { getAdminReviewDetail } from '../../../api/reviews.js';

export function useAdminReviewDetailQuery(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['admin', 'reviews', id],
    queryFn: async () => {
      const { data } = await getAdminReviewDetail(id);
      return data;
    },
    enabled: enabled && Boolean(id),
  });
}

export default useAdminReviewDetailQuery;
