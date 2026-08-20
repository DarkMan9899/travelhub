/** P1.5 (Master Roadmap) — `POST /reviews/:id/report`. */

import { useMutation } from '@tanstack/react-query';
import { reportReview } from '../../../api/reviews.js';

export function useReportReviewMutation() {
  return useMutation({
    mutationFn: ({ id, reasonCode, details }) =>
      reportReview(id, { reasonCode, details }),
  });
}

export default useReportReviewMutation;
