/**
 * Notifications query-key factory (FRONTEND_ARCHITECTURE.md §14.1) —
 * every `notifications` React Query hook builds its key through this,
 * never an ad hoc array. Mirrors `modules/favorites/constants/queryKeys.js`'s
 * shape.
 */

const notificationKeys = {
  all: ['notifications'],
  lists: (filters = {}) => [...notificationKeys.all, 'list', filters],
  unreadCount: () => [...notificationKeys.all, 'unreadCount'],
  preferences: () => [...notificationKeys.all, 'preferences'],
};

export default notificationKeys;
