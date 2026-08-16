import { describe, test, expect, jest } from '@jest/globals';
import { MessageReactionService } from '../../../../src/modules/messaging/services/messageReactionService.js';
import {
  AuthenticationError,
  NotFoundError,
} from '../../../../src/errors/AppError.js';

const PARTICIPANT = { userId: 1, roles: ['CUSTOMER'] };

function buildService(overrides = {}) {
  const messageReactionRepository = {
    toggle: jest.fn().mockResolvedValue({ added: true }),
    listForMessage: jest.fn().mockResolvedValue([]),
    ...overrides.messageReactionRepository,
  };
  const messageRepository = {
    findById: jest.fn().mockResolvedValue({ id: 5, conversationId: 1 }),
    ...overrides.messageRepository,
  };
  const conversationService = {
    assertCanWrite: jest.fn().mockResolvedValue(undefined),
    ...overrides.conversationService,
  };
  const service = new MessageReactionService({
    messageReactionRepository,
    messageRepository,
    conversationService,
  });
  return {
    service,
    messageReactionRepository,
    messageRepository,
    conversationService,
  };
}

describe('MessageReactionService', () => {
  test('throws AuthenticationError with no principal', async () => {
    const { service } = buildService();
    await expect(service.toggleReaction(null, 5, '👍')).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  test('throws NotFoundError when the message does not exist', async () => {
    const { service } = buildService({
      messageRepository: { findById: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.toggleReaction(PARTICIPANT, 999, '👍'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('asserts the principal can write to the message’s conversation, then toggles', async () => {
    const { service, conversationService, messageReactionRepository } =
      buildService();
    await service.toggleReaction(PARTICIPANT, 5, '👍');
    expect(conversationService.assertCanWrite).toHaveBeenCalledWith(
      PARTICIPANT,
      1,
    );
    expect(messageReactionRepository.toggle).toHaveBeenCalledWith(5, 1, '👍');
  });

  test('returns the added flag plus the full reaction list', async () => {
    const { service } = buildService({
      messageReactionRepository: {
        toggle: jest.fn().mockResolvedValue({ added: false }),
        listForMessage: jest
          .fn()
          .mockResolvedValue([{ userId: 2, reactionCode: '❤️' }]),
      },
    });
    const result = await service.toggleReaction(PARTICIPANT, 5, '👍');
    expect(result).toEqual({
      added: false,
      reactions: [{ userId: 2, reactionCode: '❤️' }],
    });
  });
});
