/**
 * `useUpdateUserStatusMutation` — wraps `PATCH /users/:id/status`
 * (suspend/activate/ban).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserStatus } from '../../../api/admin.js';

export function useUpdateUserStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }) => updateUserStatus(id, status),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', id] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'users'],
        exact: false,
      });
    },
  });
}

export default useUpdateUserStatusMutation;
