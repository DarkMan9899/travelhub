/**
 * P1.6 (Master Roadmap) — `GET /cms/pages/:slug`, the six static public
 * pages' now-real content source. `retry: false` and no `isError`
 * handling by any caller is deliberate: a 404 (unknown/unpublished
 * slug — true today for `blog`) is an expected, silent "nothing to
 * show yet" outcome here, not a failure to surface — each page already
 * has its own static i18n copy as the fallback (`data ?? t(...)`), so
 * there's nothing for an error state to add.
 */

import { useQuery } from '@tanstack/react-query';
import { getCmsPage } from '../../../api/cms.js';

export function useCmsPageQuery(slug, locale) {
  return useQuery({
    queryKey: ['cms', 'page', slug, locale],
    queryFn: async () => {
      const { data } = await getCmsPage(slug, locale);
      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export default useCmsPageQuery;
