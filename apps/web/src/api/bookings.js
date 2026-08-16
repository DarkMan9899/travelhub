/**
 * Bookings module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/bookings/module.routes.js`.
 * Every route requires authentication — there is no public/unauthenticated
 * view of a booking, unlike Listings/Availability's public browse surfaces.
 */

import apiClient from './client.js';

/**
 * `POST /bookings` — `{ items: [{ holdIds, guests? }], guestContactSnapshot:
 * {fullName, email, phone?}, customerNotes? }`. Converts already-granted
 * holds into a real, `PENDING_VENDOR` booking; price/capacity are always
 * resolved server-side, never trusted from this payload.
 */
export function createBooking(payload) {
  return apiClient.post('/bookings', payload).then((response) => response.data);
}

/**
 * `GET /bookings` — defaults to the caller's own bookings ("My Trips").
 * Phase 9 (Partner Dashboard): also accepts `partnerId`/`status` for a
 * partner's booking-management workspace (`bookingValidators.js`'s
 * `listBookingsQuerySchema` — `BookingService.listBookings` requires
 * ownership or `booking.view_all` for the `partnerId` form).
 * @param {{ partnerId?: number, status?: string, cursor?: string, limit?: number }} params
 */
export function listMyBookings(params) {
  return apiClient
    .get('/bookings', { params })
    .then((response) => response.data);
}

/** `GET /bookings/:id` — 404-masked to the booking's own customer or the listing's partner. */
export function getBooking(id) {
  return apiClient.get(`/bookings/${id}`).then((response) => response.data);
}

/**
 * `POST /bookings/:id/confirm` (Phase 9: Partner Dashboard). Owner/staff of
 * the listing's partner, or `booking.confirm` — moves `PENDING_VENDOR` ->
 * `CONFIRMED`.
 */
export function confirmBooking(id) {
  return apiClient
    .post(`/bookings/${id}/confirm`)
    .then((response) => response.data);
}

/**
 * `POST /bookings/:id/reject` — `{ reason? }` (Phase 9: Partner Dashboard).
 * Owner/staff of the listing's partner, or `booking.reject` — moves
 * `PENDING_VENDOR` -> `REJECTED` and restores held capacity.
 */
export function rejectBooking(id, reason) {
  return apiClient
    .post(`/bookings/${id}/reject`, { reason })
    .then((response) => response.data);
}

/**
 * `POST /bookings/:id/cancel` — `{ reason? }`. One endpoint for both
 * sides: the booking's own customer (`CANCELLED_BY_CUSTOMER`) or the
 * listing's partner owner/staff/`booking.cancel_any` admin
 * (`CANCELLED_BY_VENDOR`) — the terminal status is resolved server-side
 * from the caller's identity, never sent by this call.
 */
export function cancelBooking(id, reason) {
  return apiClient
    .post(`/bookings/${id}/cancel`, { reason })
    .then((response) => response.data);
}

/**
 * `POST /bookings/:id/complete` — owner/staff of the listing's partner,
 * or `booking.confirm` (no dedicated `booking.complete` permission is
 * seeded — see `bookingService.js`'s own comment) — moves `CONFIRMED` ->
 * `COMPLETED`.
 */
export function completeBooking(id) {
  return apiClient
    .post(`/bookings/${id}/complete`)
    .then((response) => response.data);
}

/**
 * `POST /bookings/:id/no-show` — same permission as `completeBooking` —
 * moves `CONFIRMED` -> `NO_SHOW`.
 */
export function markBookingNoShow(id) {
  return apiClient
    .post(`/bookings/${id}/no-show`)
    .then((response) => response.data);
}

/**
 * `GET /bookings/:id/history` (Stage 11.4 — Admin Platform: Booking
 * Operations). The real `booking_status_history` timeline — every
 * `{ from_status, to_status, changed_by, changed_at }` transition row,
 * oldest first. Same 404-masked visibility as `getBooking`.
 */
export function getBookingHistory(id) {
  return apiClient
    .get(`/bookings/${id}/history`)
    .then((response) => response.data);
}
