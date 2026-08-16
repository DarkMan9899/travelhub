/**
 * `useCreateCmsPageMutation` — wraps `POST /cms/admin/pages`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCmsPage } from '../../../api/cms.js';

export function useCreateCmsPageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createCmsPage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cms', 'pages'] });
    },
  });
}

export default useCreateCmsPageMutation;
