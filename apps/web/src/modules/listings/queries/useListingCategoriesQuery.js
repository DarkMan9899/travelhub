/**
 * `useListingCategoriesQuery` — wraps `GET /search/categories` for
 * `CategoryStep`. Calls `api/search.js`'s `getCategories` directly
 * (shared infra, not a feature module) rather than importing `modules/
 * search`'s own `useCategoriesQuery` hook: FRONTEND_ARCHITECTURE.md
 * §6.3's dependency direction is `search` may depend on `listings`,
 * never the reverse, so `listings` importing from `modules/search`
 * would invert that rule even though both hooks fetch the same
 * endpoint. The category list itself is real `listing_categories` data,
 * already localized server-side — nothing about it is wizard-specific,
 * it's just reached through a different module boundary here.
 *
 * `staleTime: 5 minutes` — same cache class `useCategoriesQuery` already
 * uses for this near-static taxonomy.
 *
 * `locale` must be forwarded explicitly, same as `useCategoriesQuery`
 * (`modules/home/components/Categories/Categories.jsx`'s own caller):
 * the backend resolves category-name localization from the `?locale=`
 * query param only (`searchController.js` reads `req.validated.query.
 * locale`), not from the `Accept-Language` header `api/client.js` sets —
 * no backend code reads that header. Omitting `locale` here would
 * silently pin `CategoryStep`'s category names to the platform default
 * language regardless of the wizard's own UI locale.
 */

import { useQuery } from '@tanstack/react-query';
import { getCategories } from '../../../api/search.js';
import listingKeys from '../constants/queryKeys.js';

export function useListingCategoriesQuery(locale) {
  return useQuery({
    queryKey: listingKeys.categories(locale),
    queryFn: async () => {
      const { data } = await getCategories({ locale });
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default useListingCategoriesQuery;
