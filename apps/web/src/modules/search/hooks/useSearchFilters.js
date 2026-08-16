/**
 * `useSearchFilters` — the URL is the single source of truth for
 * "classic search" filter state (FRONTEND_ARCHITECTURE.md's URL-sync
 * rule), this hook is the only thing that reads or writes it.
 *
 * `updateFilters` takes a `{ replace }` option so callers can choose the
 * right history behavior per FRONTEND_ARCHITECTURE.md's Back/Forward
 * requirement: a debounced keystroke in the keyword field should
 * *replace* the current history entry (so Back doesn't have to be
 * pressed once per letter typed), while a discrete choice — picking a
 * category, choosing a sort option, removing one filter chip — should
 * *push* a new entry, so Back meaningfully undoes that one action.
 *
 * `updateDynamicFilter` (Phase 4.2) is the write side of `dynamicFilters`
 * (the generic `attr_*`/`amenityIds` bag `DynamicFilterPanel` owns). It
 * takes a `patch` object (`{ [key]: value }`, possibly several keys at
 * once) rather than one `(key, value)` pair, merged into the existing bag
 * in a single update — a RANGE control writes its `_min`/`_max` keys
 * together for exactly this reason: two separate `updateDynamicFilter`
 * calls in the same event handler would each read the same
 * not-yet-re-rendered `filters.dynamicFilters` snapshot, so the second
 * call would silently overwrite the first's change instead of merging
 * with it. `updateFilters` itself drops the *entire* `dynamicFilters` bag the
 * moment `categoryId` changes to a different category (unless the caller
 * explicitly supplied its own `dynamicFilters` in the same call): a
 * filter selected under the old category's catalog (e.g. `bedrooms`)
 * isn't just hidden under the new one, it's meaningless — leaving it in
 * the URL would silently keep narrowing results by a filter nothing on
 * screen shows as active.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  parseSearchParams,
  buildSearchParams,
} from '../schemas/searchParams.js';
import {
  DEFAULT_SORT_KEY,
  SORT_OPTION_META,
} from '../../../constants/sortOptions.js';

export function useSearchFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseSearchParams(searchParams),
    [searchParams],
  );

  const updateFilters = useCallback(
    (partial, { replace = false } = {}) => {
      const next = { ...filters, ...partial };
      if (
        'categoryId' in partial &&
        partial.categoryId !== filters.categoryId &&
        !('dynamicFilters' in partial)
      ) {
        next.dynamicFilters = {};
      }
      // A sort option that `requiresKeyword` (currently only
      // "relevance") stops meaning anything the moment the keyword it
      // depends on is gone — downgrading it here keeps the UI's sort
      // control from showing a choice that would silently do nothing
      // (the backend itself falls back the same way, server-side).
      if (SORT_OPTION_META[next.sort]?.requiresKeyword && !next.destination) {
        next.sort = DEFAULT_SORT_KEY;
      }
      setSearchParams(buildSearchParams(next), { replace });
    },
    [filters, setSearchParams],
  );

  const updateDynamicFilter = useCallback(
    (patch) => {
      const nextDynamicFilters = { ...filters.dynamicFilters };
      Object.entries(patch).forEach(([key, value]) => {
        if (value) {
          nextDynamicFilters[key] = value;
        } else {
          delete nextDynamicFilters[key];
        }
      });
      updateFilters({ dynamicFilters: nextDynamicFilters }, { replace: false });
    },
    [filters.dynamicFilters, updateFilters],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const hasActiveFilters = Boolean(
    filters.destination ||
    filters.categoryId ||
    filters.sort !== DEFAULT_SORT_KEY ||
    Object.keys(filters.dynamicFilters).length > 0,
  );

  return {
    filters,
    updateFilters,
    updateDynamicFilter,
    clearFilters,
    hasActiveFilters,
  };
}

export default useSearchFilters;
