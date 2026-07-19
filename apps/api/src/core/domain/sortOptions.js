/**
 * Search sort-option resolution — Sprint 8's "newest/oldest/alphabetical/
 * relevance" sorting (`API_SPECIFICATION.md` §14). Pure domain lookup,
 * mirrors `listingStatusTransitions.js`'s shape.
 *
 * `relevance` only means something when a keyword was supplied (it orders
 * by FULLTEXT match score, `modules/search/repositories/
 * mysqlSearchRepository.js`) — requesting it without a keyword resolves to
 * `newest` rather than erroring, a documented fallback rather than a
 * silent bug (BACKEND_ARCHITECTURE.md §10 validation strategy: a
 * meaningless-but-harmless combination degrades gracefully).
 */

const SORT_OPTIONS = Object.freeze({
  newest: Object.freeze({
    column: 'created_at',
    direction: 'DESC',
    requiresKeyword: false,
  }),
  oldest: Object.freeze({
    column: 'created_at',
    direction: 'ASC',
    requiresKeyword: false,
  }),
  alphabetical: Object.freeze({
    column: 'title',
    direction: 'ASC',
    requiresKeyword: false,
  }),
  relevance: Object.freeze({
    column: 'relevance_score',
    direction: 'DESC',
    requiresKeyword: true,
  }),
});

export const SORT_KEYS = Object.freeze(Object.keys(SORT_OPTIONS));

export const DEFAULT_SORT_KEY = 'newest';

/**
 * @param {string} sortKey
 * @param {{hasKeyword?: boolean}} [options]
 * @returns {{key: string, column: string, direction: 'ASC'|'DESC', requiresKeyword: boolean}}
 */
export function resolveSortOption(sortKey, { hasKeyword = false } = {}) {
  const option = SORT_OPTIONS[sortKey];
  if (!option) {
    throw new TypeError(`Unknown sort option "${sortKey}".`);
  }
  if (option.requiresKeyword && !hasKeyword) {
    return { key: DEFAULT_SORT_KEY, ...SORT_OPTIONS[DEFAULT_SORT_KEY] };
  }
  return { key: sortKey, ...option };
}

export default {
  SORT_KEYS,
  DEFAULT_SORT_KEY,
  resolveSortOption,
};
