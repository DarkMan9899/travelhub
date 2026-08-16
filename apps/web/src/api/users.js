/**
 * Users module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/users/module.routes.js`
 * — every route requires authentication, handled by `client.js`'s
 * interceptor.
 */

import apiClient from './client.js';

export function updateProfile(userId, fields) {
  return apiClient
    .patch(`/users/${userId}`, fields)
    .then((response) => response.data);
}

export function changePassword(userId, { currentPassword, newPassword }) {
  return apiClient
    .post(`/users/${userId}/change-password`, { currentPassword, newPassword })
    .then((response) => response.data);
}

/**
 * `POST /users/:id/avatar` — raw binary body, matching
 * `module.routes.js`'s `express.raw()` scoping (never multipart/
 * form-data — this endpoint's Content-Type IS the image's own MIME type).
 */
export function uploadAvatar(userId, file) {
  return apiClient
    .post(`/users/${userId}/avatar`, file, {
      headers: { 'Content-Type': file.type },
    })
    .then((response) => response.data);
}
