import { describe, test, expect, jest } from '@jest/globals';
import { ConversationService } from '../../../../src/modules/messaging/services/conversationService.js';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../../src/errors/AppError.js';

const PARTICIPANT = { userId: 1, roles: ['CUSTOMER'] };
const OUTSIDER = { userId: 99, roles: ['CUSTOMER'] };
const SUPPORT_VIEW_ALL = { userId: 50, roles: ['SUPPORT'] };

function buildService(overrides = {}) {
  const conversationRepository = {
    isParticipant: jest.fn((conversationId, userId) => userId === 1),
    findById: jest.fn().mockResolvedValue({ id: 1, createdBy: 1 }),
    findByIdForUser: jest.fn().mockResolvedValue({
      id: 1,
      createdBy: 1,
      isArchivedForParticipant: false,
    }),
    markRead: jest.fn().mockResolvedValue(undefined),
    countUnreadConversations: jest.fn().mockResolvedValue(0),
    setArchivedForParticipant: jest.fn().mockResolvedValue(undefined),
    listParticipantUserIds: jest.fn().mockResolvedValue([1, 2]),
    listParticipantProfiles: jest.fn().mockResolvedValue([]),
    ...overrides.conversationRepository,
  };
  const permissionResolver = {
    hasPermission: jest
      .fn()
      .mockImplementation((roles, key) =>
        Promise.resolve(
          roles.includes('SUPPORT') && key === 'messaging.view_all',
        ),
      ),
    ...overrides.permissionResolver,
  };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const auditLogger = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ConversationService({
    conversationRepository,
    permissionResolver,
    auditLogger,
    eventBus,
  });
  return { service, conversationRepository, permissionResolver, eventBus };
}

describe('ConversationService', () => {
  describe('createConversation', () => {
    test('throws AuthenticationError with no principal', async () => {
      const { service } = buildService();
      await expect(
        service.createConversation(null, { participantUserIds: [2] }),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });

    test('throws ValidationError when fewer than 2 unique participants result', async () => {
      const { service } = buildService();
      // Principal is 1; supplying only their own id de-dupes to a single participant.
      await expect(
        service.createConversation(PARTICIPANT, { participantUserIds: [1] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    // Creating a brand-new conversation opens a real `withTransaction`
    // (a real MySQL connection) — same established convention as
    // `messageService.test.js`'s `sendMessage`: that path is proven at
    // the integration level (`tests/integration/modules/messaging/`),
    // not by mocking the transaction module here. What IS safely
    // unit-testable without touching real infrastructure is the
    // idempotent-by-context short-circuit below, since it returns
    // before `withTransaction` is ever reached.
    test('reuses an existing conversation for the same context instead of creating a duplicate', async () => {
      const { service, conversationRepository, eventBus } = buildService({
        conversationRepository: {
          findByContextForUser: jest
            .fn()
            .mockResolvedValue({ id: 9, createdBy: 1, contextType: 'booking' }),
          create: jest.fn(),
        },
      });
      const conversation = await service.createConversation(PARTICIPANT, {
        participantUserIds: [2],
        contextType: 'booking',
        contextId: 42,
      });
      expect(conversationRepository.findByContextForUser).toHaveBeenCalledWith(
        'booking',
        42,
        1,
      );
      expect(conversationRepository.create).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(conversation).toEqual({
        id: 9,
        createdBy: 1,
        contextType: 'booking',
        participants: [],
      });
    });
  });

  describe('assertCanRead', () => {
    test('passes for a real participant', async () => {
      const { service } = buildService();
      await expect(
        service.assertCanRead(PARTICIPANT, 1),
      ).resolves.toBeUndefined();
    });

    test('passes for a non-participant with messaging.view_all', async () => {
      const { service } = buildService();
      await expect(
        service.assertCanRead(SUPPORT_VIEW_ALL, 1),
      ).resolves.toBeUndefined();
    });

    test('throws AuthorizationError for a non-participant without messaging.view_all', async () => {
      const { service } = buildService();
      await expect(service.assertCanRead(OUTSIDER, 1)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
    });

    test('throws AuthenticationError with no principal', async () => {
      const { service } = buildService();
      await expect(service.assertCanRead(null, 1)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });
  });

  describe('getConversation', () => {
    test('throws NotFoundError when the repository has no row', async () => {
      const { service } = buildService({
        conversationRepository: {
          findByIdForUser: jest.fn().mockResolvedValue(null),
        },
      });
      await expect(
        service.getConversation(PARTICIPANT, 1),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    test('returns the conversation, enriched with the participant own read/archive state', async () => {
      const { service } = buildService();
      const conversation = await service.getConversation(PARTICIPANT, 1);
      expect(conversation).toEqual({
        id: 1,
        createdBy: 1,
        isArchivedForParticipant: false,
        participants: [],
      });
    });

    test('a non-participant with messaging.view_all gets the bare conversation, no personal state', async () => {
      const { service, conversationRepository } = buildService();
      const conversation = await service.getConversation(SUPPORT_VIEW_ALL, 1);
      expect(conversationRepository.findById).toHaveBeenCalledWith(1);
      expect(conversation).toEqual({ id: 1, createdBy: 1, participants: [] });
    });

    test('excludes the requesting principal from the participants list', async () => {
      const { service } = buildService({
        conversationRepository: {
          listParticipantProfiles: jest.fn().mockResolvedValue([
            { conversationId: 1, userId: 1, firstName: 'Me', lastName: 'Self' },
            {
              conversationId: 1,
              userId: 2,
              firstName: 'Other',
              lastName: 'Person',
              avatarUrl: '/avatar.png',
            },
          ]),
        },
      });
      const conversation = await service.getConversation(PARTICIPANT, 1);
      expect(conversation.participants).toEqual([
        {
          userId: 2,
          firstName: 'Other',
          lastName: 'Person',
          avatarUrl: '/avatar.png',
        },
      ]);
    });
  });

  describe('markAsRead', () => {
    test('throws AuthorizationError for a non-participant', async () => {
      const { service } = buildService();
      await expect(service.markAsRead(OUTSIDER, 1, 10)).rejects.toBeInstanceOf(
        AuthorizationError,
      );
    });

    test('updates the read cursor and publishes MESSAGE_READ for a participant', async () => {
      const { service, conversationRepository, eventBus } = buildService();
      await service.markAsRead(PARTICIPANT, 1, 10);
      expect(conversationRepository.markRead).toHaveBeenCalledWith(1, 1, 10);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'message.read' }),
      );
    });
  });

  describe('getUnreadConversationCount', () => {
    test('throws AuthenticationError with no principal', async () => {
      const { service } = buildService();
      await expect(
        service.getUnreadConversationCount(null),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });
  });

  describe('setArchivedForParticipant', () => {
    test('publishes CONVERSATION_ARCHIVED only when archiving, not unarchiving', async () => {
      const { service, eventBus } = buildService();
      await service.setArchivedForParticipant(PARTICIPANT, 1, true);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'conversation.archived' }),
      );

      eventBus.publish.mockClear();
      await service.setArchivedForParticipant(PARTICIPANT, 1, false);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    test('throws AuthorizationError for a non-participant', async () => {
      const { service } = buildService();
      await expect(
        service.setArchivedForParticipant(OUTSIDER, 1, true),
      ).rejects.toBeInstanceOf(AuthorizationError);
    });
  });

  describe('listParticipants', () => {
    test('delegates to the repository', async () => {
      const { service, conversationRepository } = buildService();
      const participants = await service.listParticipants(1);
      expect(
        conversationRepository.listParticipantUserIds,
      ).toHaveBeenCalledWith(1);
      expect(participants).toEqual([1, 2]);
    });
  });
});
