/**
 * `useDeleteCmsPageMutation` — wraps `DELETE /cms/admin/pages/:id`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCmsPage } from '../../../api/cms.js';

export function useDeleteCmsPageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => deleteCmsPage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cms', 'pages'] });
    },
  });
}

export default useDeleteCmsPageMutation;
