/**
 * Booking-Holds module — raw endpoint calls (FRONTEND_ARCHITECTURE.md
 * §3.1's `api/` contract). Mirrors `apps/api/src/modules/booking-holds/
 * module.routes.js`. Every route requires authentication — holds are
 * always the caller's own, self-service, never an admin/partner view.
 */

import apiClient from './client.js';

/**
 * `POST /booking-holds` — `{ items: [{ bookableUnitId, dateFrom, dateTo,
 * quantity? }] }`, all-or-nothing across items. Response:
 * `{ items: [{bookable_unit_id, date_from, date_to, quantity, hold_ids}],
 * expires_at }`.
 */
export function createBookingHolds(items) {
  return apiClient
    .post('/booking-holds', { items })
    .then((response) => response.data);
}

/** `GET /booking-holds` — the caller's own active holds. */
export function listBookingHolds() {
  return apiClient.get('/booking-holds').then((response) => response.data);
}

/** `DELETE /booking-holds` — `{ holdIds }`, releases holds and restores capacity. */
export function releaseBookingHolds(holdIds) {
  return apiClient
    .delete('/booking-holds', { data: { holdIds } })
    .then((response) => response.data);
}
