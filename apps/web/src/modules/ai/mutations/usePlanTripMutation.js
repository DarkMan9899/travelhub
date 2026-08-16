/** `usePlanTripMutation` — wraps `POST /ai/trip-planner`. */

import { useMutation } from '@tanstack/react-query';
import { planTrip } from '../../../api/ai.js';

export function usePlanTripMutation() {
  return useMutation({
    mutationFn: (input) => planTrip(input),
  });
}

export default usePlanTripMutation;
