/**
 * Notifications module — raw endpoint calls (FRONTEND_ARCHITECTURE.md
 * §3.1's `api/` contract). Mirrors
 * `apps/api/src/modules/notifications/module.routes.js`. Every route
 * requires authentication — a notification is always the requester's own.
 */

import apiClient from './client.js';

/** `GET /notifications` — cursor-paginated, filterable by status/category/search. */
export function listNotifications({
  status,
  category,
  search,
  cursor,
  limit,
} = {}) {
  return apiClient
    .get('/notifications', {
      params: { status, category, search, cursor, limit },
    })
    .then((response) => response.data);
}

/** `GET /notifications/unread-count`. */
export function getUnreadCount() {
  return apiClient
    .get('/notifications/unread-count')
    .then((response) => response.data);
}

/** `PATCH /notifications/:id/read`. */
export function markNotificationRead(id) {
  return apiClient
    .patch(`/notifications/${id}/read`)
    .then((response) => response.data);
}

/** `POST /notifications/read-all`. */
export function markAllNotificationsRead() {
  return apiClient
    .post('/notifications/read-all')
    .then((response) => response.data);
}

/** `PATCH /notifications/:id/archive`. */
export function archiveNotification(id) {
  return apiClient
    .patch(`/notifications/${id}/archive`)
    .then((response) => response.data);
}

/** `DELETE /notifications/:id`. */
export function deleteNotification(id) {
  return apiClient
    .delete(`/notifications/${id}`)
    .then((response) => response.data);
}

/** `GET /notifications/preferences`. */
export function listNotificationPreferences() {
  return apiClient
    .get('/notifications/preferences')
    .then((response) => response.data);
}

/** `PATCH /notifications/preferences/:category` — `{ inAppEnabled, emailEnabled }`. */
export function updateNotificationPreference(
  category,
  { inAppEnabled, emailEnabled },
) {
  return apiClient
    .patch(`/notifications/preferences/${category}`, {
      inAppEnabled,
      emailEnabled,
    })
    .then((response) => response.data);
}
