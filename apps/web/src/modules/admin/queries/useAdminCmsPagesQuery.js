/**
 * `useAdminCmsPagesQuery` — wraps `GET /cms/admin/pages`. No pagination
 * (the page set is small and admin-curated), matching Stage 11.5's
 * `useAdminConfigResource` list queries.
 */

import { useQuery } from '@tanstack/react-query';
import { getAdminCmsPages } from '../../../api/cms.js';

export function useAdminCmsPagesQuery() {
  return useQuery({
    queryKey: ['admin', 'cms', 'pages'],
    queryFn: () => getAdminCmsPages().then((response) => response.data),
  });
}

export default useAdminCmsPagesQuery;
