/**
 * Redis-caching decorator around a `PermissionRepository`.
 *
 * Implements `API_SPECIFICATION.md` §18: server-side permission/role
 * resolution cached with a 60-second default TTL, so a permission
 * revocation takes effect platform-wide within that bound without
 * requiring full token invalidation (`API_SPECIFICATION.md` §6 point 2).
 * Wraps any `PermissionRepository` implementation transparently — the
 * `PermissionResolver` domain service never knows caching exists.
 *
 * Cache key uses the shared `CACHE:` prefix
 * (`src/infrastructure/cache/redisClient.js`'s `REDIS_KEY_PREFIXES`) —
 * role codes are sorted before joining so the same role set always
 * produces the same cache key regardless of array order.
 *
 * A Redis outage degrades to an uncached DB read on every call (fail
 * open) — never a failed request — matching the rate limiter's
 * fail-open discipline (`src/middleware/rateLimiter.js`).
 */

import { getRedisClient, REDIS_KEY_PREFIXES } from './redisClient.js';
import { PermissionRepository } from '../../core/interfaces/PermissionRepository.js';

const DEFAULT_TTL_SECONDS = 60;

export class CachedPermissionRepository extends PermissionRepository {
  #repository;

  #redis;

  #ttlSeconds;

  constructor(
    repository,
    redis = getRedisClient(),
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ) {
    super();
    this.#repository = repository;
    this.#redis = redis;
    this.#ttlSeconds = ttlSeconds;
  }

  #cacheKey(roleCodes) {
    const sorted = [...roleCodes].sort().join(',');
    return `${REDIS_KEY_PREFIXES.CACHE}permissions:${sorted}`;
  }

  async getPermissionKeysForRoleCodes(roleCodes) {
    if (roleCodes.length === 0) return [];
    const key = this.#cacheKey(roleCodes);

    try {
      const cached = await this.#redis.get(key);
      if (cached !== null) return JSON.parse(cached);
    } catch {
      // Redis unavailable or a corrupt entry — fall through to the DB.
    }

    const keys =
      await this.#repository.getPermissionKeysForRoleCodes(roleCodes);

    try {
      await this.#redis.set(key, JSON.stringify(keys), 'EX', this.#ttlSeconds);
    } catch {
      // Best-effort — a failed cache write must never fail the request.
    }

    return keys;
  }
}

export default CachedPermissionRepository;
