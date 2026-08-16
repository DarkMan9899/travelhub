/** AI Assistant response DTOs (Stage 15.3). */

export function toAskResponse(result) {
  return {
    conversation_id: result.conversationId,
    message: result.message,
    provider_code: result.providerCode,
  };
}

export function toAssistantConversationListResponse(page) {
  return {
    results: page.rows.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    })),
    meta: page.meta,
  };
}

export function toAssistantConversationResponse(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.createdAt,
    })),
  };
}
