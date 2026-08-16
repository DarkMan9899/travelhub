/**
 * `useUpdateProfileMutation` — wraps `PATCH /users/:id`
 * (FRONTEND_ARCHITECTURE.md §14.5). `onSuccess` calls `AuthContext`'s
 * `refreshUser()` so the header/menu and every other consumer of
 * `useAuth().user` reflect the edit immediately, without a page reload.
 */

import { useMutation } from '@tanstack/react-query';
import { updateProfile } from '../../../api/users.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';

export function useUpdateProfileMutation(userId) {
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: (fields) => updateProfile(userId, fields),
    onSuccess: () => refreshUser(),
  });
}

export default useUpdateProfileMutation;
