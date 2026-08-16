/**
 * `useUpsertCmsTranslationMutation` — wraps
 * `PUT /cms/admin/pages/:id/translations/:languageCode`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertCmsTranslation } from '../../../api/cms.js';

export function useUpsertCmsTranslationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, languageCode, ...payload }) =>
      upsertCmsTranslation(id, languageCode, payload),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'cms', 'pages', id],
      });
    },
  });
}

export default useUpsertCmsTranslationMutation;
