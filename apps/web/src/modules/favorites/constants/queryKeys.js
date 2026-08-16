/**
 * Favorites query-key factory (FRONTEND_ARCHITECTURE.md §14.1) — every
 * `favorites` React Query hook builds its key through this, never an ad
 * hoc array. Mirrors `modules/bookings/constants/queryKeys.js`'s shape.
 */

const favoriteKeys = {
  all: ['favorites'],
  ids: () => [...favoriteKeys.all, 'ids'],
  lists: () => [...favoriteKeys.all, 'list'],
};

export default favoriteKeys;
