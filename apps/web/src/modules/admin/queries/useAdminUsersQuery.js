/**
 * `useAdminUsersQuery` — wraps `GET /users` (admin list), cursor-paginated
 * the same way every other admin/dashboard list in this app is
 * (`useInfiniteQuery` + "Load more", never the unused `Pagination`
 * primitive — see `DataTable`'s own header comment).
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { getUsers } from '../../../api/admin.js';

export const ADMIN_USERS_LIMIT = 20;

export function useAdminUsersQuery({ keyword, status } = {}) {
  return useInfiniteQuery({
    queryKey: ['admin', 'users', { keyword, status }],
    queryFn: async ({ pageParam }) => {
      const { data, meta } = await getUsers({
        keyword: keyword || undefined,
        status: status || undefined,
        limit: ADMIN_USERS_LIMIT,
        cursor: pageParam ?? undefined,
      });
      return { results: data, meta };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    staleTime: 30 * 1000,
  });
}

export default useAdminUsersQuery;
