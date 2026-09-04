/**
 * `useAdminResolveRefundReviewMutation` — wraps
 * `POST /bookings/:id/resolve-refund-review` (`{ reason }`, required).
 * A real backend action (`payment.refund`, admin-only) that previously
 * had no frontend wiring at all — moves `refund_status` from
 * `REQUIRES_MANUAL_REVIEW` to `RESOLVED_NO_REFUND`. Writes no money.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveRefundReview } from '../../../api/bookings.js';

export function useAdminResolveRefundReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }) => resolveRefundReview(id, reason),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'bookings'],
        exact: false,
      });
    },
  });
}

export default useAdminResolveRefundReviewMutation;
