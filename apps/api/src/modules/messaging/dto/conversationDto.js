/**
 * Messaging module response DTOs — conversation shape
 * (BACKEND_ARCHITECTURE.md Ch.9).
 */

export function toConversationResponse(conversation) {
  return {
    id: conversation.id,
    context_type: conversation.contextType,
    context_id: conversation.contextId,
    created_by: conversation.createdBy,
    last_message_at: conversation.lastMessageAt,
    is_archived: conversation.isArchived,
    archived_at: conversation.archivedAt,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
    // The OTHER participants' display profile — never includes the
    // requester themselves (see `conversationService.#attachParticipants`).
    participants: (conversation.participants ?? []).map((participant) => ({
      user_id: participant.userId,
      first_name: participant.firstName,
      last_name: participant.lastName,
      avatar_url: participant.avatarUrl,
    })),
    ...(conversation.unreadCount !== undefined && {
      unread_count: conversation.unreadCount,
    }),
    ...(conversation.lastMessagePreview !== undefined && {
      last_message_preview: conversation.lastMessagePreview,
    }),
    ...(conversation.isArchivedForParticipant !== undefined && {
      is_archived_for_participant: conversation.isArchivedForParticipant,
    }),
    ...(conversation.lastReadMessageId !== undefined && {
      last_read_message_id: conversation.lastReadMessageId,
    }),
  };
}

export function toUnreadConversationCountResponse(count) {
  return { unread_count: count };
}
