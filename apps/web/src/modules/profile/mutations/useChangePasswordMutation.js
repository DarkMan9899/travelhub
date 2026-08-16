/**
 * `useChangePasswordMutation` — wraps `POST /users/:id/change-password`
 * (FRONTEND_ARCHITECTURE.md §14.5). No cache to invalidate — the password
 * itself is never part of any query's data — so this has no `onSuccess`
 * side effect beyond what the caller (`ChangePasswordForm`) does with the
 * resolved promise (show a toast, reset the form).
 */

import { useMutation } from '@tanstack/react-query';
import { changePassword } from '../../../api/users.js';

export function useChangePasswordMutation(userId) {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      changePassword(userId, { currentPassword, newPassword }),
  });
}

export default useChangePasswordMutation;
