/**
 * MessageReactionService — Phase 14 (Messaging Platform). Depends on
 * `MessageService` (to resolve which conversation a message belongs to)
 * and `ConversationService` (participant check) — never a second
 * Repository over `messages`/`conversation_participants`.
 */

import {
  AuthenticationError,
  NotFoundError,
} from '../../../errors/AppError.js';

export class MessageReactionService {
  #messageReactionRepository;

  #messageRepository;

  #conversationService;

  constructor({
    messageReactionRepository,
    messageRepository,
    conversationService,
  }) {
    this.#messageReactionRepository = messageReactionRepository;
    this.#messageRepository = messageRepository;
    this.#conversationService = conversationService;
  }

  async toggleReaction(principal, messageId, reactionCode) {
    if (!principal) throw new AuthenticationError();
    const message = await this.#messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message not found.');
    await this.#conversationService.assertCanWrite(
      principal,
      message.conversationId,
    );
    const result = await this.#messageReactionRepository.toggle(
      messageId,
      principal.userId,
      reactionCode,
    );
    const reactions =
      await this.#messageReactionRepository.listForMessage(messageId);
    return { ...result, reactions };
  }
}

export default MessageReactionService;
