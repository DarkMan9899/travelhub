import { describe, test, expect, jest } from '@jest/globals';
import { AiConversationService } from '../../../../src/modules/ai/services/aiConversationService.js';
import {
  AuthenticationError,
  NotFoundError,
} from '../../../../src/errors/AppError.js';

function buildService() {
  const aiConversationRepository = {
    create: jest
      .fn()
      .mockResolvedValue({ id: 1, userId: 1, featureCode: 'trip_planner' }),
    findById: jest
      .fn()
      .mockResolvedValue({ id: 1, userId: 1, featureCode: 'trip_planner' }),
    touchUpdatedAt: jest.fn().mockResolvedValue(undefined),
    listForUser: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
    softDelete: jest.fn().mockResolvedValue(undefined),
  };
  const aiMessageRepository = {
    create: jest
      .fn()
      .mockResolvedValue({ id: 10, role: 'user', content: 'hi' }),
    listForConversation: jest
      .fn()
      .mockResolvedValue([{ id: 10, role: 'user', content: 'hi' }]),
  };
  const service = new AiConversationService({
    aiConversationRepository,
    aiMessageRepository,
  });
  return { service, aiConversationRepository, aiMessageRepository };
}

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };
const OTHER = { userId: 2, roles: ['CUSTOMER'] };

describe('AiConversationService', () => {
  test('createConversation requires a principal and scopes to their own userId', async () => {
    const { service, aiConversationRepository } = buildService();
    await expect(
      service.createConversation(null, { featureCode: 'trip_planner' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    await service.createConversation(PRINCIPAL, {
      featureCode: 'trip_planner',
    });
    expect(aiConversationRepository.create).toHaveBeenCalledWith({
      userId: 1,
      featureCode: 'trip_planner',
      title: null,
    });
  });

  test('appendMessage saves the message and touches the conversation', async () => {
    const { service, aiMessageRepository, aiConversationRepository } =
      buildService();
    await service.appendMessage(1, { role: 'user', content: 'hi' });
    expect(aiMessageRepository.create).toHaveBeenCalledWith({
      conversationId: 1,
      role: 'user',
      content: 'hi',
    });
    expect(aiConversationRepository.touchUpdatedAt).toHaveBeenCalledWith(1);
  });

  test('getConversationWithMessages 404s for a non-owner (never leaks existence)', async () => {
    const { service } = buildService();
    await expect(
      service.getConversationWithMessages(OTHER, 1),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('getConversationWithMessages returns the conversation with its messages for the owner', async () => {
    const { service } = buildService();
    const result = await service.getConversationWithMessages(PRINCIPAL, 1);
    expect(result.id).toBe(1);
    expect(result.messages).toHaveLength(1);
  });

  test('deleteConversation 404s for a non-owner and soft-deletes for the owner', async () => {
    const { service, aiConversationRepository } = buildService();
    await expect(service.deleteConversation(OTHER, 1)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await service.deleteConversation(PRINCIPAL, 1);
    expect(aiConversationRepository.softDelete).toHaveBeenCalledWith(1);
  });
});
