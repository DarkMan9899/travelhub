/** `useRecommendationsQuery` — wraps `GET /ai/recommendations`. */

import { useQuery } from '@tanstack/react-query';
import { getRecommendations } from '../../../api/ai.js';
import aiKeys from '../constants/queryKeys.js';

export function useRecommendationsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: aiKeys.recommendations(),
    queryFn: () => getRecommendations(),
    enabled,
  });
}

export default useRecommendationsQuery;
