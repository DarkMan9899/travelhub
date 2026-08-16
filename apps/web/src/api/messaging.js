/**
 * Messaging module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/messaging/module.routes.js`.
 * Every route requires authentication — a conversation is always one the
 * requester participates in (or has `messaging.view_all` for reads).
 */

import apiClient from './client.js';

/** `GET /messaging/conversations` — cursor-paginated, filterable by status/search. */
export function listConversations({ status, search, cursor, limit } = {}) {
  return apiClient
    .get('/messaging/conversations', {
      params: { status, search, cursor, limit },
    })
    .then((response) => response.data);
}

/** `POST /messaging/conversations` — `{ participantUserIds, contextType?, contextId? }`. */
export function createConversation({
  participantUserIds,
  contextType,
  contextId,
}) {
  return apiClient
    .post('/messaging/conversations', {
      participantUserIds,
      contextType,
      contextId,
    })
    .then((response) => response.data);
}

/** `GET /messaging/conversations/:id`. */
export function getConversation(id) {
  return apiClient
    .get(`/messaging/conversations/${id}`)
    .then((response) => response.data);
}

/** `GET /messaging/conversations/unread-count`. */
export function getUnreadConversationCount() {
  return apiClient
    .get('/messaging/conversations/unread-count')
    .then((response) => response.data);
}

/** `PATCH /messaging/conversations/:id/read` — `{ lastReadMessageId }`. */
export function markConversationRead(id, lastReadMessageId) {
  return apiClient
    .patch(`/messaging/conversations/${id}/read`, { lastReadMessageId })
    .then((response) => response.data);
}

/** `PATCH /messaging/conversations/:id/archive`. */
export function archiveConversation(id) {
  return apiClient
    .patch(`/messaging/conversations/${id}/archive`)
    .then((response) => response.data);
}

/** `PATCH /messaging/conversations/:id/unarchive`. */
export function unarchiveConversation(id) {
  return apiClient
    .patch(`/messaging/conversations/${id}/unarchive`)
    .then((response) => response.data);
}

/** `GET /messaging/conversations/:id/messages` — backward cursor (oldest-first page). */
export function listMessages(conversationId, { cursor, limit } = {}) {
  return apiClient
    .get(`/messaging/conversations/${conversationId}/messages`, {
      params: { cursor, limit },
    })
    .then((response) => response.data);
}

/** `POST /messaging/conversations/:id/messages` — `{ body, attachmentMediaIds? }`. */
export function sendMessage(conversationId, { body, attachmentMediaIds }) {
  return apiClient
    .post(`/messaging/conversations/${conversationId}/messages`, {
      body,
      attachmentMediaIds,
    })
    .then((response) => response.data);
}

/** `DELETE /messaging/conversations/:id/messages/:messageId`. */
export function deleteMessage(conversationId, messageId) {
  return apiClient
    .delete(`/messaging/conversations/${conversationId}/messages/${messageId}`)
    .then((response) => response.data);
}

/** `POST /messaging/conversations/:id/messages/:messageId/reactions` — `{ reactionCode }`. */
export function toggleMessageReaction(conversationId, messageId, reactionCode) {
  return apiClient
    .post(
      `/messaging/conversations/${conversationId}/messages/${messageId}/reactions`,
      { reactionCode },
    )
    .then((response) => response.data);
}

/** `GET /messaging/messages/search?q=`. */
export function searchMessages({ q, cursor, limit } = {}) {
  return apiClient
    .get('/messaging/messages/search', { params: { q, cursor, limit } })
    .then((response) => response.data);
}

/**
 * `POST /messaging/conversations/:id/attachments` — raw binary body, one
 * request per file, mirroring `attachListingMedia`'s exact shape (the
 * backend has no multipart endpoint — see `module.routes.js`'s
 * `express.raw()` scoping). Returns the uploaded media row; reference its
 * `id` in `attachmentMediaIds` when calling `sendMessage`.
 * @param {number} conversationId
 * @param {File} file
 */
export function uploadMessageAttachment(conversationId, file) {
  return apiClient
    .post(`/messaging/conversations/${conversationId}/attachments`, file, {
      headers: { 'Content-Type': file.type },
    })
    .then((response) => response.data);
}

/** `POST /messaging/conversations/:id/typing` — fire-and-forget presence ping. */
export function setTyping(conversationId) {
  return apiClient
    .post(`/messaging/conversations/${conversationId}/typing`)
    .then((response) => response.data);
}

/** `GET /messaging/conversations/:id/typing` — userIds of other participants currently typing. */
export function listTypingUsers(conversationId) {
  return apiClient
    .get(`/messaging/conversations/${conversationId}/typing`)
    .then((response) => response.data);
}
