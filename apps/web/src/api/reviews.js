/**
 * Reviews module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/reviews/module.routes.js`.
 */

import apiClient from './client.js';

/** `POST /reviews` — `{ bookingId, rating, title?, content? }`. Requires the booking to be COMPLETED and owned by the caller. */
export function submitReview(payload) {
  return apiClient.post('/reviews', payload).then((response) => response.data);
}

/** `GET /reviews/booking/:bookingId` — the caller's own review for a booking, or `null` if not yet written. */
export function getReviewForBooking(bookingId) {
  return apiClient
    .get(`/reviews/booking/${bookingId}`)
    .then((response) => response.data);
}

/** `GET /reviews?listingId=` — public, cursor-paginated; `meta` also carries `rating_average`/`review_count`. */
export function listListingReviews(listingId, { cursor, limit } = {}) {
  return apiClient
    .get('/reviews', { params: { listingId, cursor, limit } })
    .then((response) => response.data);
}
