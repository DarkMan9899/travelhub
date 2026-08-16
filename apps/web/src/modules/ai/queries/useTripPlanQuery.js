/** `useTripPlanQuery` — wraps `GET /ai/trip-planner/:id`. */

import { useQuery } from '@tanstack/react-query';
import { getTripPlan } from '../../../api/ai.js';
import aiKeys from '../constants/queryKeys.js';

export function useTripPlanQuery(conversationId) {
  return useQuery({
    queryKey: aiKeys.tripPlan(conversationId),
    queryFn: () => getTripPlan(conversationId),
    enabled: Boolean(conversationId),
  });
}

export default useTripPlanQuery;
