import { describe, test, expect, jest } from '@jest/globals';
import { MessageService } from '../../../../src/modules/messaging/services/messageService.js';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from '../../../../src/errors/AppError.js';

const SENDER = { userId: 1, roles: ['CUSTOMER'] };
const MODERATOR = { userId: 9, roles: ['MODERATOR'] };
const NON_MODERATOR = { userId: 99, roles: ['CUSTOMER'] };

function buildService(overrides = {}) {
  const messageRepository = {
    create: jest.fn().mockResolvedValue({
      id: 5,
      conversationId: 1,
      senderUserId: 1,
      body: 'hi',
      createdAt: new Date(),
    }),
    findById: jest
      .fn()
      .mockResolvedValue({ id: 5, conversationId: 1, senderUserId: 1 }),
    listForConversation: jest
      .fn()
      .mockResolvedValue({ rows: [{ id: 2 }, { id: 1 }], meta: {} }),
    softDelete: jest.fn().mockResolvedValue(true),
    search: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
    ...overrides.messageRepository,
  };
  const conversationRepository = {
    touchLastMessageAt: jest.fn().mockResolvedValue(undefined),
    listConversationIdsForUser: jest.fn().mockResolvedValue([1, 2]),
    ...overrides.conversationRepository,
  };
  const messageAttachmentRepository = {
    attachToMessage: jest.fn().mockResolvedValue(0),
    listForMessages: jest.fn().mockResolvedValue([]),
    ...overrides.messageAttachmentRepository,
  };
  const messageReactionRepository = {
    listForMessages: jest.fn().mockResolvedValue([]),
    ...overrides.messageReactionRepository,
  };
  const conversationService = {
    assertCanWrite: jest.fn().mockResolvedValue(undefined),
    assertCanRead: jest.fn().mockResolvedValue(undefined),
    ...overrides.conversationService,
  };
  const permissionResolver = {
    hasPermission: jest
      .fn()
      .mockImplementation((roles) =>
        Promise.resolve(roles.includes('MODERATOR')),
      ),
    ...overrides.permissionResolver,
  };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new MessageService({
    messageRepository,
    conversationRepository,
    conversationService,
    messageAttachmentRepository,
    messageReactionRepository,
    permissionResolver,
    eventBus,
  });
  return {
    service,
    messageRepository,
    conversationRepository,
    conversationService,
    messageAttachmentRepository,
    messageReactionRepository,
    permissionResolver,
    eventBus,
  };
}

describe('MessageService', () => {
  // `sendMessage`'s success path opens a real `withTransaction` (a real
  // MySQL connection) — this codebase's own established convention
  // (mirrored from `bookingService.js`, which likewise has no direct
  // unit test for its transactional methods) is to prove that path at
  // the integration level instead of mocking the transaction module.
  // What's safely unit-testable without touching real infrastructure is
  // that an unauthorized write is rejected *before* any transaction ever
  // opens.
  describe('sendMessage', () => {
    test('throws AuthenticationError with no principal', async () => {
      const { service } = buildService();
      await expect(
        service.sendMessage(null, 1, { body: 'hi' }),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });

    test('propagates an authorization failure and never reaches the repository', async () => {
      const rejection = new AuthorizationError();
      const { service, messageRepository } = buildService({
        conversationService: {
          assertCanWrite: jest.fn().mockRejectedValue(rejection),
        },
      });
      await expect(service.sendMessage(SENDER, 1, { body: 'hi' })).rejects.toBe(
        rejection,
      );
      expect(messageRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('listForConversation', () => {
    test('asserts read access and returns messages reversed to oldest-first', async () => {
      const { service, conversationService } = buildService();
      const { rows } = await service.listForConversation(SENDER, 1, {});
      expect(conversationService.assertCanRead).toHaveBeenCalledWith(SENDER, 1);
      expect(rows).toEqual([
        { id: 1, attachments: [], reactions: [] },
        { id: 2, attachments: [], reactions: [] },
      ]);
    });

    test('groups attachments by their owning message id', async () => {
      const { service } = buildService({
        messageAttachmentRepository: {
          listForMessages: jest.fn().mockResolvedValue([
            { id: 10, mediableId: 1, url: 'a.png' },
            { id: 11, mediableId: 2, url: 'b.pdf' },
          ]),
        },
      });
      const { rows } = await service.listForConversation(SENDER, 1, {});
      expect(rows.find((r) => r.id === 1).attachments).toEqual([
        { id: 10, mediableId: 1, url: 'a.png' },
      ]);
      expect(rows.find((r) => r.id === 2).attachments).toEqual([
        { id: 11, mediableId: 2, url: 'b.pdf' },
      ]);
    });

    test('groups reactions by their owning message id', async () => {
      const { service } = buildService({
        messageReactionRepository: {
          listForMessages: jest.fn().mockResolvedValue([
            { id: 20, messageId: 1, userId: 3, reactionCode: '👍' },
            { id: 21, messageId: 2, userId: 4, reactionCode: '❤️' },
          ]),
        },
      });
      const { rows } = await service.listForConversation(SENDER, 1, {});
      expect(rows.find((r) => r.id === 1).reactions).toEqual([
        { id: 20, messageId: 1, userId: 3, reactionCode: '👍' },
      ]);
      expect(rows.find((r) => r.id === 2).reactions).toEqual([
        { id: 21, messageId: 2, userId: 4, reactionCode: '❤️' },
      ]);
    });
  });

  describe('softDeleteMessage', () => {
    test('throws AuthenticationError with no principal', async () => {
      const { service } = buildService();
      await expect(service.softDeleteMessage(null, 5)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    test('throws NotFoundError when the message does not exist', async () => {
      const { service } = buildService({
        messageRepository: { findById: jest.fn().mockResolvedValue(null) },
      });
      await expect(
        service.softDeleteMessage(SENDER, 999),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    test('the sender can delete their own message via a participant check', async () => {
      const { service, conversationService, messageRepository } =
        buildService();
      await service.softDeleteMessage(SENDER, 5);
      expect(conversationService.assertCanWrite).toHaveBeenCalledWith(
        SENDER,
        1,
      );
      expect(messageRepository.softDelete).toHaveBeenCalledWith(5, 1);
    });

    test('a non-sender without messaging.moderate cannot delete the message', async () => {
      const { service } = buildService();
      await expect(
        service.softDeleteMessage(NON_MODERATOR, 5),
      ).rejects.toBeInstanceOf(AuthorizationError);
    });

    test('a moderator can delete someone else’s message', async () => {
      const { service, messageRepository } = buildService();
      await service.softDeleteMessage(MODERATOR, 5);
      expect(messageRepository.softDelete).toHaveBeenCalledWith(5, 9);
    });
  });

  describe('searchMessages', () => {
    test('throws AuthenticationError with no principal', async () => {
      const { service } = buildService();
      await expect(service.searchMessages(null, 'hi')).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    test('scopes the search to the principal’s own conversations', async () => {
      const { service, messageRepository } = buildService();
      await service.searchMessages(SENDER, 'hello', { limit: 10 });
      expect(messageRepository.search).toHaveBeenCalledWith([1, 2], 'hello', {
        limit: 10,
      });
    });
  });
});
