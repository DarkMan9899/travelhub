/**
 * Reviews query-key factory (FRONTEND_ARCHITECTURE.md §14.1) — every
 * `reviews` React Query hook builds its key through this, never an ad
 * hoc array. Mirrors `modules/bookings/constants/queryKeys.js`'s shape.
 */

const reviewKeys = {
  all: ['reviews'],
  forListing: (listingId) => [...reviewKeys.all, 'listing', listingId],
  forBooking: (bookingId) => [...reviewKeys.all, 'booking', bookingId],
};

export default reviewKeys;
