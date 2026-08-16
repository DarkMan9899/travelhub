/**
 * `useAdminUserDetailQuery` — wraps `GET /users/:id` (admin detail).
 */

import { useQuery } from '@tanstack/react-query';
import { getUserDetail } from '../../../api/admin.js';

export function useAdminUserDetailQuery(userId) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: async () => {
      const { data } = await getUserDetail(userId);
      return data;
    },
    enabled: Boolean(userId),
  });
}

export default useAdminUserDetailQuery;
