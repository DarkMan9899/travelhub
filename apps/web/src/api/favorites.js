/**
 * Favorites module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/favorites/module.routes.js`.
 * Every route requires authentication — favorites are always the
 * requester's own.
 */

import apiClient from './client.js';

/** `POST /favorites` — `{ listingId }`. */
export function addFavorite(listingId) {
  return apiClient
    .post('/favorites', { listingId })
    .then((response) => response.data);
}

/** `DELETE /favorites/:listingId`. */
export function removeFavorite(listingId) {
  return apiClient
    .delete(`/favorites/${listingId}`)
    .then((response) => response.data);
}

/** `GET /favorites/ids` — every favorited listing id, for hydrating heart-toggle state on card grids. */
export function listFavoriteIds() {
  return apiClient.get('/favorites/ids').then((response) => response.data);
}

/** `GET /favorites` — cursor-paginated, listing-summary-joined; powers the Favorites list page. */
export function listFavorites({ cursor, limit } = {}) {
  return apiClient
    .get('/favorites', { params: { cursor, limit } })
    .then((response) => response.data);
}
