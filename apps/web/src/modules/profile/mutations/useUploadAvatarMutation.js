/**
 * `useUploadAvatarMutation` — wraps `POST /users/:id/avatar`
 * (FRONTEND_ARCHITECTURE.md §14.5). `onSuccess` calls `AuthContext`'s
 * `refreshUser()` so the new `avatar_url` shows up immediately in
 * `UserMenu` and everywhere else `useAuth().user` is read.
 */

import { useMutation } from '@tanstack/react-query';
import { uploadAvatar } from '../../../api/users.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';

export function useUploadAvatarMutation(userId) {
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: (file) => uploadAvatar(userId, file),
    onSuccess: () => refreshUser(),
  });
}

export default useUploadAvatarMutation;
