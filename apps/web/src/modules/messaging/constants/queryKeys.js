/**
 * Messaging query-key factory (FRONTEND_ARCHITECTURE.md §14.1) — every
 * `messaging` React Query hook builds its key through this, never an ad
 * hoc array. Mirrors `modules/notifications/constants/queryKeys.js`'s shape.
 */

const messagingKeys = {
  all: ['messaging'],
  conversations: (filters = {}) => [
    ...messagingKeys.all,
    'conversations',
    filters,
  ],
  conversation: (id) => [...messagingKeys.all, 'conversation', id],
  unreadCount: () => [...messagingKeys.all, 'unreadCount'],
  messages: (conversationId) => [
    ...messagingKeys.all,
    'messages',
    conversationId,
  ],
  typingUsers: (conversationId) => [
    ...messagingKeys.all,
    'typingUsers',
    conversationId,
  ],
  search: (query) => [...messagingKeys.all, 'search', query],
};

export default messagingKeys;
