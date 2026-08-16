/**
 * TypingIndicatorService — Phase 14 (Messaging Platform).
 *
 * Ephemeral presence only — never written to MySQL. A short-TTL Redis key
 * per (conversationId, userId), following the exact
 * `REDIS_KEY_PREFIXES`-scoped key convention `cachedPermissionRepository.js`/
 * `loginAttemptTracker.js` already use. Reuses the shared Redis connection
 * (`getRedisClient()`) rather than introducing a second one.
 *
 * Depends on `ConversationService`'s public assert methods for
 * participant access control, never re-implementing it.
 */

import {
  getRedisClient,
  REDIS_KEY_PREFIXES,
} from '../../../infrastructure/cache/redisClient.js';
import { AuthenticationError } from '../../../errors/AppError.js';

const TYPING_TTL_SECONDS = 6;

export class TypingIndicatorService {
  #conversationService;

  #redis;

  constructor({ conversationService, redis = getRedisClient() }) {
    this.#conversationService = conversationService;
    this.#redis = redis;
  }

  #key(conversationId, userId) {
    return `${REDIS_KEY_PREFIXES.TYPING}${conversationId}:${userId}`;
  }

  async setTyping(principal, conversationId) {
    if (!principal) throw new AuthenticationError();
    await this.#conversationService.assertCanWrite(principal, conversationId);
    await this.#redis.set(
      this.#key(conversationId, principal.userId),
      '1',
      'EX',
      TYPING_TTL_SECONDS,
    );
  }

  /** Returns the userIds of every OTHER participant currently typing. */
  async listTypingUsers(principal, conversationId) {
    if (!principal) throw new AuthenticationError();
    await this.#conversationService.assertCanRead(principal, conversationId);
    const pattern = `${REDIS_KEY_PREFIXES.TYPING}${conversationId}:*`;
    const keys = await this.#redis.keys(pattern);
    return keys
      .map((key) => Number(key.slice(key.lastIndexOf(':') + 1)))
      .filter((userId) => userId !== principal.userId);
  }
}

export default TypingIndicatorService;
