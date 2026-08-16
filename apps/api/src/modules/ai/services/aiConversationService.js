/**
 * AiConversationService (Phase 15) — the generic conversation-thread
 * primitive shared by every AI feature that needs turn-by-turn history
 * (`tripPlannerService.js`, `assistantService.js`). Owns ownership
 * checks (a conversation belongs to exactly one user, no
 * `messaging.view_all`-style admin override exists here — AI
 * conversations are private, matching `ai_user_memory`'s privacy stance).
 */

import {
  AuthenticationError,
  NotFoundError,
} from '../../../errors/AppError.js';

export class AiConversationService {
  #aiConversationRepository;

  #aiMessageRepository;

  constructor({ aiConversationRepository, aiMessageRepository }) {
    this.#aiConversationRepository = aiConversationRepository;
    this.#aiMessageRepository = aiMessageRepository;
  }

  async createConversation(principal, { featureCode, title = null }) {
    if (!principal) throw new AuthenticationError();
    return this.#aiConversationRepository.create({
      userId: principal.userId,
      featureCode,
      title,
    });
  }

  async appendMessage(conversationId, message) {
    const saved = await this.#aiMessageRepository.create({
      conversationId,
      ...message,
    });
    await this.#aiConversationRepository.touchUpdatedAt(conversationId);
    return saved;
  }

  async #assertOwner(principal, conversationId) {
    if (!principal) throw new AuthenticationError();
    const conversation =
      await this.#aiConversationRepository.findById(conversationId);
    if (!conversation || conversation.userId !== principal.userId) {
      throw new NotFoundError('Conversation not found.');
    }
    return conversation;
  }

  async getConversationWithMessages(principal, conversationId) {
    const conversation = await this.#assertOwner(principal, conversationId);
    const messages =
      await this.#aiMessageRepository.listForConversation(conversationId);
    return { ...conversation, messages };
  }

  async listForUser(principal, filters = {}) {
    if (!principal) throw new AuthenticationError();
    return this.#aiConversationRepository.listForUser(
      principal.userId,
      filters,
    );
  }

  async deleteConversation(principal, conversationId) {
    await this.#assertOwner(principal, conversationId);
    await this.#aiConversationRepository.softDelete(conversationId);
  }
}

export default AiConversationService;
