/** `useAskAssistantMutation` — wraps the synchronous `POST /ai/assistant` fallback. */

import { useMutation } from '@tanstack/react-query';
import { askAssistant } from '../../../api/ai.js';

export function useAskAssistantMutation() {
  return useMutation({
    mutationFn: (input) => askAssistant(input),
  });
}

export default useAskAssistantMutation;
