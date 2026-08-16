/**
 * AiCacheService (Phase 15) — the first real consumer of
 * `REDIS_KEY_PREFIXES.CACHE` (defined but unused since Sprint 1).
 *
 * Caches only non-streaming `AiService.complete()` results, keyed by a
 * hash of `(featureCode, providerCode, messages)` — never streaming
 * responses (a cached stream would defeat the point of streaming). A
 * Redis outage degrades to "always miss" (never blocks or errors a
 * request), matching `middleware/rateLimiter.js`'s established
 * fail-open precedent for this exact kind of non-critical infrastructure.
 */

import { createHash } from 'node:crypto';
import {
  getRedisClient,
  REDIS_KEY_PREFIXES,
} from '../../../infrastructure/cache/redisClient.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('ai:cache');

function buildKey(featureCode, providerCode, messages) {
  const hash = createHash('sha256')
    .update(JSON.stringify({ featureCode, providerCode, messages }))
    .digest('hex');
  return `${REDIS_KEY_PREFIXES.CACHE}ai:${featureCode}:${hash}`;
}

export class AiCacheService {
  #ttlSeconds;

  #redisClientFactory;

  constructor({ ttlSeconds, redisClientFactory = getRedisClient }) {
    this.#ttlSeconds = ttlSeconds;
    this.#redisClientFactory = redisClientFactory;
  }

  async get(featureCode, providerCode, messages) {
    try {
      const raw = await this.#redisClientFactory().get(
        buildKey(featureCode, providerCode, messages),
      );
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      log.warn({ err }, 'AI cache read failed — treating as a miss');
      return null;
    }
  }

  async set(featureCode, providerCode, messages, value) {
    try {
      await this.#redisClientFactory().set(
        buildKey(featureCode, providerCode, messages),
        JSON.stringify(value),
        'EX',
        this.#ttlSeconds,
      );
    } catch (err) {
      log.warn(
        { err },
        'AI cache write failed — response was still returned to the caller',
      );
    }
  }
}

export default AiCacheService;
