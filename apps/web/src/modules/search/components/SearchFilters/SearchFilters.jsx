/**
 * SearchFilters — the "classic search" filter bar: keyword, category,
 * sort, plus active-filter chips and a clear-all action.
 *
 * Every other filter (rating, rooms, cuisine, amenities, and any
 * category-specific attribute) is dynamic, backend-declared metadata, not
 * a fixed set this component could enumerate — that's
 * `DynamicFilterPanel`'s job (Phase 4.2), rendered as a sibling next to
 * this component in `SearchPageContent`, never folded into this file.
 * Still no city/country/region controls here — no endpoint exists yet to
 * enumerate real option values for them. See `modules/search/README.md`.
 *
 * Deliberately scoped to *this* (classic) search mode only — Stage 15.2's
 * `AiSearchBar` is a sibling component with its own state, not a change
 * to this one; `SearchPageContent` is the seam where the two coexist.
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Input, Select } from '@travelhub/ui/components/form-controls';
import { Button, Badge } from '@travelhub/ui/components/primitives';
import { useCategoriesQuery } from '../../queries/useCategoriesQuery.js';
import {
  SORT_KEYS,
  SORT_OPTION_META,
} from '../../../../constants/sortOptions.js';
import styles from './SearchFilters.module.scss';

const KEYWORD_DEBOUNCE_MS = 400;

export default function SearchFilters({
  filters,
  onUpdateFilters,
  onClearFilters,
  hasActiveFilters,
}) {
  const { t } = useTranslation();
  const { data: categories = [] } = useCategoriesQuery();
  const [keywordText, setKeywordText] = useState(filters.destination);

  // Resync the local input when the URL changes from elsewhere (a chip
  // removal, clear-all, or browser Back/Forward) — never fires for this
  // component's own debounced write, since that write only happens once
  // `keywordText` already equals `filters.destination` (see below).
  useEffect(() => {
    setKeywordText(filters.destination);
  }, [filters.destination]);

  useEffect(() => {
    if (keywordText === filters.destination) return undefined;
    const timeout = setTimeout(() => {
      onUpdateFilters({ destination: keywordText }, { replace: true });
    }, KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // Only the debounced text itself should re-arm the timer; including
    // filters.destination/onUpdateFilters would re-fire this on every
    // URL change, defeating the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordText]);

  const categoryOptions = [
    { value: '', label: t('search.filters.categoryAll') },
    ...categories.map((category) => ({
      value: String(category.id),
      label: category.name,
    })),
  ];

  const sortOptions = SORT_KEYS.filter(
    (key) => !SORT_OPTION_META[key].requiresKeyword || filters.destination,
  ).map((key) => ({ value: key, label: t(`search.filters.sort.${key}`) }));

  const selectedCategory = categories.find(
    (category) => category.id === filters.categoryId,
  );

  return (
    <div className={styles.filters}>
      <div className={styles.controls}>
        <div className={styles.keywordField}>
          <Input
            aria-label={t('search.filters.keywordLabel')}
            placeholder={t('search.filters.keywordPlaceholder')}
            value={keywordText}
            onChange={(event) => setKeywordText(event.target.value)}
            iconLeft={<Search size={18} aria-hidden="true" />}
          />
        </div>
        <div className={styles.categoryField}>
          <Select
            ariaLabel={t('search.filters.categoryLabel')}
            placeholder={t('search.filters.categoryAll')}
            options={categoryOptions}
            value={filters.categoryId ? String(filters.categoryId) : ''}
            onChange={(value) =>
              onUpdateFilters(
                { categoryId: value ? Number(value) : undefined },
                { replace: false },
              )
            }
          />
        </div>
        <div className={styles.sortField}>
          <Select
            ariaLabel={t('search.filters.sortLabel')}
            options={sortOptions}
            value={filters.sort}
            onChange={(value) =>
              onUpdateFilters({ sort: value }, { replace: false })
            }
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div
          className={styles.chips}
          role="group"
          aria-label={t('search.filters.activeFilters')}
        >
          {filters.destination && (
            <button
              type="button"
              className={styles.chip}
              onClick={() =>
                onUpdateFilters({ destination: '' }, { replace: false })
              }
            >
              <Badge variant="neutral" label={filters.destination} size="sm" />
              <X size={14} aria-hidden="true" />
              <span className={styles.chipSrLabel}>
                {t('search.filters.removeFilter', {
                  label: filters.destination,
                })}
              </span>
            </button>
          )}
          {selectedCategory && (
            <button
              type="button"
              className={styles.chip}
              onClick={() =>
                onUpdateFilters({ categoryId: undefined }, { replace: false })
              }
            >
              <Badge
                variant="neutral"
                label={selectedCategory.name}
                size="sm"
              />
              <X size={14} aria-hidden="true" />
              <span className={styles.chipSrLabel}>
                {t('search.filters.removeFilter', {
                  label: selectedCategory.name,
                })}
              </span>
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            {t('search.filters.clearAll')}
          </Button>
        </div>
      )}
    </div>
  );
}

SearchFilters.propTypes = {
  filters: PropTypes.shape({
    destination: PropTypes.string,
    categoryId: PropTypes.number,
    sort: PropTypes.string,
  }).isRequired,
  onUpdateFilters: PropTypes.func.isRequired,
  onClearFilters: PropTypes.func.isRequired,
  hasActiveFilters: PropTypes.bool.isRequired,
};
