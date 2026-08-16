/**
 * Messaging module response DTOs — message shape
 * (BACKEND_ARCHITECTURE.md Ch.9).
 */

export function toAttachmentResponse(attachment) {
  return {
    id: attachment.id,
    url: attachment.url,
    mime_type: attachment.mimeType,
    media_type: attachment.mediaTypeCode,
    file_size_bytes: attachment.fileSizeBytes,
  };
}

export function toReactionResponse(reaction) {
  return {
    user_id: reaction.userId,
    reaction_code: reaction.reactionCode,
    created_at: reaction.createdAt,
  };
}

export function toMessageResponse(message) {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    sender_user_id: message.senderUserId,
    body: message.body,
    is_edited: message.isEdited,
    edited_at: message.editedAt,
    created_at: message.createdAt,
    attachments: (message.attachments ?? []).map(toAttachmentResponse),
    reactions: (message.reactions ?? []).map(toReactionResponse),
  };
}

export function toReactionToggleResponse({ added, reactions }) {
  return {
    added,
    reactions: reactions.map(toReactionResponse),
  };
}
