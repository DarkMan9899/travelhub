/**
 * Search query-key factory (FRONTEND_ARCHITECTURE.md §14.1) — every
 * `search` React Query hook builds its key through this, never an ad hoc
 * array, mirroring `modules/listings/constants/queryKeys.js`.
 */

const searchKeys = {
  all: ['search'],
  categories: () => [...searchKeys.all, 'categories'],
  destinations: () => [...searchKeys.all, 'destinations'],
  suggestions: (query) => [...searchKeys.all, 'suggestions', { query }],
  results: (filters) => [...searchKeys.all, 'results', filters],
  filterDefinitions: (categoryId) => [
    ...searchKeys.all,
    'filterDefinitions',
    { categoryId },
  ],
};

export default searchKeys;
