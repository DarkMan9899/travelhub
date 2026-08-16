/**
 * ConversationService — Phase 14 (Messaging Platform).
 *
 * Participant access control lives here, never in a route guard
 * (matches `bookingService.js`'s `#assertOwnerOrPermission` precedent):
 * every read/write method asserts the requester is either a real
 * participant, or — for reads only — holds `messaging.view_all`
 * (mirrors `booking.view_all` exactly). `messaging.view_all` never
 * grants write access to a conversation the principal doesn't belong to.
 *
 * Publishes `CONVERSATION_CREATED`/`CONVERSATION_ARCHIVED` after the
 * write commits — never inside a transaction, matching every other
 * business service's event-publish rule from Phase 13.
 */

import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../errors/AppError.js';
import { withTransaction } from '../../../infrastructure/database/transaction.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';

const VIEW_ALL_PERMISSION = 'messaging.view_all';

export class ConversationService {
  #conversationRepository;

  #permissionResolver;

  #auditLogger;

  #eventBus;

  constructor({
    conversationRepository,
    permissionResolver,
    auditLogger,
    eventBus = createNoOpEventBus(),
  }) {
    this.#conversationRepository = conversationRepository;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
    this.#eventBus = eventBus;
  }

  async #hasViewAll(principal) {
    return this.#permissionResolver.hasPermission(
      principal.roles,
      VIEW_ALL_PERMISSION,
    );
  }

  /** Throws unless the principal participates, or (read-only) has `messaging.view_all`. */
  async assertCanRead(principal, conversationId) {
    if (!principal) throw new AuthenticationError();
    const isParticipant = await this.#conversationRepository.isParticipant(
      conversationId,
      principal.userId,
    );
    if (isParticipant) return;
    if (await this.#hasViewAll(principal)) return;
    throw new AuthorizationError();
  }

  async #assertCanWrite(principal, conversationId) {
    if (!principal) throw new AuthenticationError();
    const isParticipant = await this.#conversationRepository.isParticipant(
      conversationId,
      principal.userId,
    );
    if (!isParticipant) throw new AuthorizationError();
  }

  /**
   * Enriches conversation rows with the OTHER participants' display
   * profile (name/avatar) — a chat UI is unusable without knowing who
   * you're talking to. Read-only, display-only: never used for the
   * access-control decisions above, which stay on `isParticipant`/
   * `listParticipantUserIds` alone.
   */
  async #attachParticipants(conversations, excludingUserId) {
    if (conversations.length === 0) return conversations;
    const profiles = await this.#conversationRepository.listParticipantProfiles(
      conversations.map((conversation) => conversation.id),
    );
    const byConversationId = new Map();
    const otherProfiles = profiles.filter(
      (profile) => profile.userId !== excludingUserId,
    );
    for (const profile of otherProfiles) {
      const list = byConversationId.get(profile.conversationId) ?? [];
      list.push({
        userId: profile.userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
      });
      byConversationId.set(profile.conversationId, list);
    }
    return conversations.map((conversation) => ({
      ...conversation,
      participants: byConversationId.get(conversation.id) ?? [],
    }));
  }

  async createConversation(
    principal,
    { participantUserIds, contextType = null, contextId = null },
  ) {
    if (!principal) throw new AuthenticationError();
    const uniqueParticipantIds = [
      ...new Set([...participantUserIds, principal.userId]),
    ];
    if (uniqueParticipantIds.length < 2) {
      throw new ValidationError(
        'A conversation needs at least one other participant.',
        [{ field: 'participantUserIds', issue: 'TOO_FEW_PARTICIPANTS' }],
      );
    }

    // Idempotent-by-context: re-opening "message the partner about
    // booking X" must land in the SAME thread, not spawn a duplicate one
    // every time the entry point is used. Only applies when a context is
    // actually given — free-standing conversations (no context) always
    // create a new thread, matching every pre-existing caller/test.
    if (contextType && contextId) {
      const existing = await this.#conversationRepository.findByContextForUser(
        contextType,
        contextId,
        principal.userId,
      );
      if (existing) {
        const [withParticipants] = await this.#attachParticipants(
          [existing],
          principal.userId,
        );
        return withParticipants;
      }
    }

    const conversation = await withTransaction((connection) =>
      this.#conversationRepository.create(
        {
          createdBy: principal.userId,
          contextType,
          contextId,
          participantUserIds: uniqueParticipantIds,
        },
        connection,
      ),
    );

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.CONVERSATION_CREATED,
        actorId: principal.userId,
        resourceType: 'conversation',
        resourceId: conversation.id,
        payload: {
          conversationId: conversation.id,
          participantUserIds: uniqueParticipantIds,
        },
      }),
    );

    const [withParticipants] = await this.#attachParticipants(
      [conversation],
      principal.userId,
    );
    return withParticipants;
  }

  async listForUser(principal, filters = {}) {
    if (!principal) throw new AuthenticationError();
    const { rows, meta } = await this.#conversationRepository.listForUser(
      principal.userId,
      filters,
    );
    const withParticipants = await this.#attachParticipants(
      rows,
      principal.userId,
    );
    return { rows: withParticipants, meta };
  }

  async getConversation(principal, conversationId) {
    await this.assertCanRead(principal, conversationId);
    const isParticipant = await this.#conversationRepository.isParticipant(
      conversationId,
      principal.userId,
    );
    // A participant gets their own unread/read-cursor/archive state; a
    // `messaging.view_all` reader who isn't a participant has no such
    // personal state to report, so falls back to the bare conversation.
    const conversation = isParticipant
      ? await this.#conversationRepository.findByIdForUser(
          conversationId,
          principal.userId,
        )
      : await this.#conversationRepository.findById(conversationId);
    if (!conversation) throw new NotFoundError('Conversation not found.');
    const [withParticipants] = await this.#attachParticipants(
      [conversation],
      principal.userId,
    );
    return withParticipants;
  }

  async markAsRead(principal, conversationId, lastReadMessageId) {
    await this.#assertCanWrite(principal, conversationId);
    await this.#conversationRepository.markRead(
      conversationId,
      principal.userId,
      lastReadMessageId,
    );
    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.MESSAGE_READ,
        actorId: principal.userId,
        resourceType: 'conversation',
        resourceId: conversationId,
        payload: { conversationId, lastReadMessageId },
      }),
    );
  }

  async getUnreadConversationCount(principal) {
    if (!principal) throw new AuthenticationError();
    return this.#conversationRepository.countUnreadConversations(
      principal.userId,
    );
  }

  async setArchivedForParticipant(principal, conversationId, isArchived) {
    await this.#assertCanWrite(principal, conversationId);
    await this.#conversationRepository.setArchivedForParticipant(
      conversationId,
      principal.userId,
      isArchived,
    );
    if (isArchived) {
      await this.#eventBus.publish(
        createDomainEvent({
          eventType: EVENT_TYPES.CONVERSATION_ARCHIVED,
          actorId: principal.userId,
          resourceType: 'conversation',
          resourceId: conversationId,
          payload: { conversationId },
        }),
      );
    }
    const conversation = await this.#conversationRepository.findByIdForUser(
      conversationId,
      principal.userId,
    );
    const [withParticipants] = await this.#attachParticipants(
      [conversation],
      principal.userId,
    );
    return withParticipants;
  }

  /**
   * Read-only, cross-module method — the ONLY way another module (the
   * Notifications listener) resolves who to notify about a message, the
   * same way `partnerService.getOwnerUserId` is already used elsewhere.
   * Never a second Repository over `conversation_participants`.
   */
  async listParticipants(conversationId) {
    return this.#conversationRepository.listParticipantUserIds(conversationId);
  }

  /** Used by MessageService to assert participation before writing a message/reaction. */
  async assertCanWrite(principal, conversationId) {
    await this.#assertCanWrite(principal, conversationId);
  }
}

export default ConversationService;
