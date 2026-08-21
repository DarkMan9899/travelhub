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

/**
 * P1.5 (Master Roadmap) — Review Trust & Safety, `/reviews/admin*`.
 * Requires `review.moderate`.
 */

/** `GET /reviews/admin` — the moderation queue, cursor-paginated. */
export function getAdminReviews(params) {
  return apiClient
    .get('/reviews/admin', { params })
    .then((response) => response.data);
}

/** `GET /reviews/admin/:id` — full detail plus every report filed against it. */
export function getAdminReviewDetail(id) {
  return apiClient
    .get(`/reviews/admin/${id}`)
    .then((response) => response.data);
}

/** `PATCH /reviews/admin/:id/moderation-status` — `{ status, notes? }`. */
export function updateReviewModerationStatus(id, status, notes) {
  return apiClient
    .patch(`/reviews/admin/${id}/moderation-status`, {
      status,
      ...(notes ? { notes } : {}),
    })
    .then((response) => response.data);
}

/**
 * `POST /reviews/:id/report` — `{ reasonCode, details? }`. Any
 * authenticated user; 409 if this caller already reported this review.
 */
export function reportReview(id, { reasonCode, details }) {
  return apiClient
    .post(`/reviews/${id}/report`, { reasonCode, details })
    .then((response) => response.data);
}

/**
 * `PUT /reviews/:id/reply` — `{ response }`. Requires
 * `RESPOND_TO_REVIEWS` on the review's own listing's partner
 * (`reviewService.js#assertCanRespondToReview`), enforced server-side.
 */
export function replyToReview(id, response) {
  return apiClient
    .put(`/reviews/${id}/reply`, { response })
    .then((res) => res.data);
}

/** `DELETE /reviews/:id/reply` — clears an existing reply. Same authorization as writing one. */
export function deleteReviewReply(id) {
  return apiClient
    .delete(`/reviews/${id}/reply`)
    .then((response) => response.data);
}
