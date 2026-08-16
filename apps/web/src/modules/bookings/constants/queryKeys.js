/**
 * Bookings query-key factory (FRONTEND_ARCHITECTURE.md §14.1) — every
 * `bookings` React Query hook builds its key through this, never an ad
 * hoc array, so cache invalidation can target precisely. Mirrors
 * `modules/listings/constants/queryKeys.js`'s exact shape.
 */

const bookingKeys = {
  all: ['bookings'],
  lists: () => [...bookingKeys.all, 'list'],
  list: (filters) => [...bookingKeys.lists(), { filters }],
  details: () => [...bookingKeys.all, 'detail'],
  detail: (id) => [...bookingKeys.details(), id],
};

export default bookingKeys;
