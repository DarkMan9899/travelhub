/**
 * MessageService — Phase 14 (Messaging Platform).
 *
 * Depends on `ConversationService`'s public interface for every
 * participant/permission check (`assertCanRead`/`assertCanWrite`) —
 * never re-implements that logic, matches the cross-module rule every
 * other module in this codebase follows (e.g. `availabilityService`
 * depending on `listingService`). `conversationRepository` here is the
 * SAME module's own repository (messaging owns both `conversations` and
 * `messages`), not a second Repository over another module's table.
 *
 * Publishes `MESSAGE_SENT` after the transaction commits — never inside
 * it — matching every business service's event-publish rule from Phase 13.
 */

import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from '../../../errors/AppError.js';
import { withTransaction } from '../../../infrastructure/database/transaction.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';

const MODERATE_PERMISSION = 'messaging.moderate';

export class MessageService {
  #messageRepository;

  #conversationRepository;

  #conversationService;

  #messageAttachmentRepository;

  #messageReactionRepository;

  #permissionResolver;

  #eventBus;

  constructor({
    messageRepository,
    conversationRepository,
    conversationService,
    messageAttachmentRepository,
    messageReactionRepository,
    permissionResolver,
    eventBus = createNoOpEventBus(),
  }) {
    this.#messageRepository = messageRepository;
    this.#conversationRepository = conversationRepository;
    this.#conversationService = conversationService;
    this.#messageAttachmentRepository = messageAttachmentRepository;
    this.#messageReactionRepository = messageReactionRepository;
    this.#permissionResolver = permissionResolver;
    this.#eventBus = eventBus;
  }

  async sendMessage(
    principal,
    conversationId,
    { body, attachmentMediaIds = [] },
  ) {
    if (!principal) throw new AuthenticationError();
    await this.#conversationService.assertCanWrite(principal, conversationId);

    const message = await withTransaction(async (connection) => {
      const created = await this.#messageRepository.create(
        { conversationId, senderUserId: principal.userId, body },
        connection,
      );
      await this.#conversationRepository.touchLastMessageAt(
        conversationId,
        created.createdAt,
        connection,
      );
      let attachments = [];
      if (attachmentMediaIds.length > 0) {
        await this.#messageAttachmentRepository.attachToMessage(
          attachmentMediaIds,
          conversationId,
          created.id,
          connection,
        );
        attachments = await this.#messageAttachmentRepository.listForMessages(
          [created.id],
          connection,
        );
      }
      return { ...created, attachments, reactions: [] };
    });

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.MESSAGE_SENT,
        actorId: principal.userId,
        resourceType: 'message',
        resourceId: message.id,
        payload: {
          conversationId,
          messageId: message.id,
          body: message.body,
        },
      }),
    );

    return message;
  }

  async listForConversation(principal, conversationId, filters = {}) {
    await this.#conversationService.assertCanRead(principal, conversationId);
    const { rows, meta } = await this.#messageRepository.listForConversation(
      conversationId,
      filters,
    );
    const messageIds = rows.map((row) => row.id);
    const [attachments, reactions] = await Promise.all([
      this.#messageAttachmentRepository.listForMessages(messageIds),
      this.#messageReactionRepository.listForMessages(messageIds),
    ]);
    const attachmentsByMessageId = new Map();
    for (const attachment of attachments) {
      const list = attachmentsByMessageId.get(attachment.mediableId) ?? [];
      list.push(attachment);
      attachmentsByMessageId.set(attachment.mediableId, list);
    }
    const reactionsByMessageId = new Map();
    for (const reaction of reactions) {
      const list = reactionsByMessageId.get(reaction.messageId) ?? [];
      list.push(reaction);
      reactionsByMessageId.set(reaction.messageId, list);
    }
    const enriched = rows.map((row) => ({
      ...row,
      attachments: attachmentsByMessageId.get(row.id) ?? [],
      reactions: reactionsByMessageId.get(row.id) ?? [],
    }));
    // Repository pages newest-first (see its header comment); a thread
    // reads oldest-to-newest top-to-bottom, so the API-facing order is
    // reversed here rather than in the repository's own query shape.
    return { rows: enriched.reverse(), meta };
  }

  async softDeleteMessage(principal, messageId) {
    if (!principal) throw new AuthenticationError();
    const message = await this.#messageRepository.findById(messageId);
    if (!message) throw new NotFoundError('Message not found.');

    const isOwnMessage = message.senderUserId === principal.userId;
    if (isOwnMessage) {
      await this.#conversationService.assertCanWrite(
        principal,
        message.conversationId,
      );
    } else {
      const canModerate = await this.#permissionResolver.hasPermission(
        principal.roles,
        MODERATE_PERMISSION,
      );
      if (!canModerate) throw new AuthorizationError();
    }

    const deleted = await this.#messageRepository.softDelete(
      messageId,
      principal.userId,
    );
    if (!deleted) throw new NotFoundError('Message not found.');
  }

  /** Scoped to conversations the principal actually participates in — never a global search. */
  async searchMessages(principal, query, filters = {}) {
    if (!principal) throw new AuthenticationError();
    const conversationIds =
      await this.#conversationRepository.listConversationIdsForUser(
        principal.userId,
      );
    return this.#messageRepository.search(conversationIds, query, filters);
  }
}

export default MessageService;
