/**
 * `useAdminListFilters` — the URL is the single source of truth for an
 * admin list page's filter state (same URL-sync rule `search`'s
 * `useSearchFilters` establishes — an admin's filtered view should be a
 * link they can share with another admin/support agent). Deliberately
 * generic (no domain logic — no `search` module dependency, since
 * FRONTEND_ARCHITECTURE.md §6.3's cross-module rule means a shared hook
 * can't live there): every admin list page (Users, and later Partners/
 * Listings/Bookings) uses this instead of a bespoke copy.
 *
 * A filter value equal to its default is omitted from the URL entirely,
 * keeping the query string minimal (`?keyword=anna` rather than
 * `?keyword=anna&status=&cursor=`).
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useAdminListFilters(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = { ...defaults };
    Object.keys(defaults).forEach((key) => {
      if (searchParams.has(key)) {
        result[key] = searchParams.get(key);
      }
    });
    return result;
  }, [searchParams, defaults]);

  const updateFilters = useCallback(
    (partial, { replace = false } = {}) => {
      const next = { ...filters, ...partial };
      const params = new URLSearchParams();
      Object.entries(next).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== '' &&
          value !== defaults[key]
        ) {
          params.set(key, value);
        }
      });
      setSearchParams(params, { replace });
    },
    [filters, defaults, setSearchParams],
  );

  return { filters, updateFilters };
}

export default useAdminListFilters;
