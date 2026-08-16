/**
 * `useAdminCmsPageDetailQuery` — wraps `GET /cms/admin/pages/:id`
 * (page settings + every locale's translation).
 */

import { useQuery } from '@tanstack/react-query';
import { getAdminCmsPageDetail } from '../../../api/cms.js';

export function useAdminCmsPageDetailQuery(pageId) {
  return useQuery({
    queryKey: ['admin', 'cms', 'pages', pageId],
    queryFn: () =>
      getAdminCmsPageDetail(pageId).then((response) => response.data),
    enabled: Boolean(pageId),
  });
}

export default useAdminCmsPageDetailQuery;
