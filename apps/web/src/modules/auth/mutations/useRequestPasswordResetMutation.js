/**
 * `useRequestPasswordResetMutation` — wraps `POST /auth/password-reset/request`
 * directly (no `AuthContext` involvement — there is no session to touch,
 * same "plain `useMutation` over a raw `api/` call" pattern
 * `useChangePasswordMutation.js` already established for a similarly
 * session-agnostic write).
 */

import { useMutation } from '@tanstack/react-query';
import { requestPasswordReset } from '../../../api/auth.js';

export function useRequestPasswordResetMutation() {
  return useMutation({ mutationFn: requestPasswordReset });
}

export default useRequestPasswordResetMutation;
