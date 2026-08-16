/**
 * `useSetTypingMutation` — wraps
 * `POST /messaging/conversations/:id/typing`. Fire-and-forget: no cache
 * invalidation, since the typing signal is ephemeral presence, not data
 * any query result depends on. Called on keystroke, debounced by the
 * composer via the same manual `setTimeout` idiom `DestinationAutocomplete`
 * already established, so this isn't fired on every single keystroke.
 */

import { useMutation } from '@tanstack/react-query';
import { setTyping } from '../../../api/messaging.js';

export function useSetTypingMutation(conversationId) {
  return useMutation({
    mutationFn: () => setTyping(conversationId),
  });
}

export default useSetTypingMutation;
