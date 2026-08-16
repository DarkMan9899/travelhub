/**
 * `useUpdateCmsPageMutation` — wraps `PATCH /cms/admin/pages/:id`
 * (slug/publish state).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCmsPage } from '../../../api/cms.js';

export function useUpdateCmsPageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => updateCmsPage(id, payload),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'cms', 'pages', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'cms', 'pages'],
        exact: true,
      });
    },
  });
}

export default useUpdateCmsPageMutation;
