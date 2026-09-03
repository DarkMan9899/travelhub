/**
 * Payments query-key factory (FRONTEND_ARCHITECTURE.md §14.1) — every
 * `payments` React Query hook builds its key through this, never an ad
 * hoc array. Mirrors `modules/bookings/constants/queryKeys.js`'s exact
 * shape.
 */

const paymentKeys = {
  all: ['payments'],
  config: () => [...paymentKeys.all, 'config'],
  lists: () => [...paymentKeys.all, 'list'],
  list: (filters) => [...paymentKeys.lists(), { filters }],
  details: () => [...paymentKeys.all, 'detail'],
  detail: (id) => [...paymentKeys.details(), id],
  forBooking: (bookingId) => [...paymentKeys.all, 'for-booking', bookingId],
  partnerBalance: (partnerId) => [
    ...paymentKeys.all,
    'partner-balance',
    partnerId,
  ],
  ledger: (filters) => [...paymentKeys.all, 'ledger', { filters }],
};

export default paymentKeys;
