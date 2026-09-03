/**
 * `useResetPasswordMutation` — wraps `POST /auth/password-reset/confirm`,
 * same rationale as `useRequestPasswordResetMutation.js`.
 */

import { useMutation } from '@tanstack/react-query';
import { resetPassword } from '../../../api/auth.js';

export function useResetPasswordMutation() {
  return useMutation({ mutationFn: resetPassword });
}

export default useResetPasswordMutation;
