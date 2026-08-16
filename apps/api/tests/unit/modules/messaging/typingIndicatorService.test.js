import { describe, test, expect, jest } from '@jest/globals';
import { TypingIndicatorService } from '../../../../src/modules/messaging/services/typingIndicatorService.js';
import { AuthenticationError } from '../../../../src/errors/AppError.js';

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };

function buildService(overrides = {}) {
  const conversationService = {
    assertCanWrite: jest.fn().mockResolvedValue(undefined),
    assertCanRead: jest.fn().mockResolvedValue(undefined),
    ...overrides.conversationService,
  };
  const redis = {
    set: jest.fn().mockResolvedValue('OK'),
    keys: jest.fn().mockResolvedValue([]),
    ...overrides.redis,
  };
  const service = new TypingIndicatorService({ conversationService, redis });
  return { service, conversationService, redis };
}

describe('TypingIndicatorService', () => {
  describe('setTyping', () => {
    test('throws AuthenticationError with no principal', async () => {
      const { service } = buildService();
      await expect(service.setTyping(null, 1)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    test('asserts write access, then sets a short-TTL key', async () => {
      const { service, conversationService, redis } = buildService();
      await service.setTyping(PRINCIPAL, 1);
      expect(conversationService.assertCanWrite).toHaveBeenCalledWith(
        PRINCIPAL,
        1,
      );
      expect(redis.set).toHaveBeenCalledWith('typing:1:1', '1', 'EX', 6);
    });
  });

  describe('listTypingUsers', () => {
    test('throws AuthenticationError with no principal', async () => {
      const { service } = buildService();
      await expect(service.listTypingUsers(null, 1)).rejects.toBeInstanceOf(
        AuthenticationError,
      );
    });

    test('asserts read access and scans this conversation’s typing keys', async () => {
      const { service, conversationService, redis } = buildService({
        redis: {
          keys: jest.fn().mockResolvedValue(['typing:1:2', 'typing:1:3']),
        },
      });
      const userIds = await service.listTypingUsers(PRINCIPAL, 1);
      expect(conversationService.assertCanRead).toHaveBeenCalledWith(
        PRINCIPAL,
        1,
      );
      expect(redis.keys).toHaveBeenCalledWith('typing:1:*');
      expect(userIds).toEqual([2, 3]);
    });

    test('excludes the requesting principal from the typing list', async () => {
      const { service } = buildService({
        redis: {
          keys: jest.fn().mockResolvedValue(['typing:1:1', 'typing:1:2']),
        },
      });
      const userIds = await service.listTypingUsers(PRINCIPAL, 1);
      expect(userIds).toEqual([2]);
    });
  });
});
