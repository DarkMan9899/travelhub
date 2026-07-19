/**
 * LoginAttemptTracker — internal Service (Module Catalog #2's
 * "Internal Services: LoginAttemptTracker"), not part of the Auth
 * module's public surface.
 *
 * Implements `BACKEND_ARCHITECTURE.md` §12: "Login-attempt lockout...
 * tracked in Redis... a sliding-window counter keyed by account, not by
 * IP alone" and `API_SPECIFICATION.md` §27: "5 consecutive failures
 * within 15 minutes triggers a temporary lockout (`ACCOUNT_LOCKED`, 423)
 * independent of the general rate limit." Uses the `SESSION:` Redis
 * prefix reserved in `src/infrastructure/cache/redisClient.js` for
 * exactly this kind of auth-adjacent ephemeral state.
 *
 * A Redis outage fails OPEN on every method (never blocks or breaks
 * login) — same discipline as `rateLimiter.js` and
 * `cachedPermissionRepository.js`.
 */

import {
  getRedisClient,
  REDIS_KEY_PREFIXES,
} from '../../../infrastructure/cache/redisClient.js';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

export class LoginAttemptTracker {
  #redis;

  constructor(redis = getRedisClient()) {
    this.#redis = redis;
  }

  #key(normalizedEmail) {
    return `${REDIS_KEY_PREFIXES.SESSION}login_attempts:${normalizedEmail}`;
  }

  /** @returns {Promise<boolean>} true if the account is currently locked. */
  async isLocked(normalizedEmail) {
    try {
      const count = await this.#redis.get(this.#key(normalizedEmail));
      return Number(count) >= MAX_ATTEMPTS;
    } catch {
      return false;
    }
  }

  async recordFailure(normalizedEmail) {
    try {
      const key = this.#key(normalizedEmail);
      const count = await this.#redis.incr(key);
      if (count === 1) {
        await this.#redis.expire(key, WINDOW_SECONDS);
      }
    } catch {
      // Best-effort — a tracker outage must never break login itself.
    }
  }

  async reset(normalizedEmail) {
    try {
      await this.#redis.del(this.#key(normalizedEmail));
    } catch {
      // Best-effort.
    }
  }
}

export default LoginAttemptTracker;
