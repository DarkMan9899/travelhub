/**
 * Redis connection.
 *
 * Implements BACKEND_ARCHITECTURE.md §38: one shared client, one
 * connection, with the five purposes (cache, distributed lock, session,
 * rate limiter, temporary hold) separated by key prefix, per Appendix A's
 * keyspace reference. BullMQ (src/infrastructure/queue/) maintains its
 * own dedicated connection rather than sharing this one, since queue
 * connections have different blocking/command requirements.
 *
 * Sprint 1 scope: the connection itself, plus the key-prefix constants
 * every future module must use. No caching/locking business logic is
 * implemented here yet.
 */

import Redis from 'ioredis';
import config from '../../config/index.js';
import { getModuleLogger } from '../../logging/logger.js';

const log = getModuleLogger('infrastructure:redis');

export const REDIS_KEY_PREFIXES = Object.freeze({
  CACHE: 'cache:',
  LOCK: 'lock:',
  SESSION: 'session:',
  RATE_LIMIT: 'ratelimit:',
  HOLD: 'hold:',
  IDEMPOTENCY: 'idempotency:',
});

let client;

/**
 * Returns the shared Redis client, creating it lazily on first use.
 *
 * IMPORTANT: `retryStrategy` is deliberately BOUNDED. ioredis's default
 * strategy retries forever with backoff, which would make `pingRedis()`
 * (and therefore GET /health/ready) hang indefinitely if Redis is
 * unreachable — directly contradicting BACKEND_ARCHITECTURE.md §50's
 * "extremely lightweight" requirement and §42's fail-fast principle.
 * Capping retries here means a genuinely down Redis surfaces as a fast,
 * clear "not ready" instead of a hung request.
 */
export function getRedisClient() {
  if (!client) {
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      connectTimeout: 3000,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying — fail fast
        return Math.min(times * 200, 2000);
      },
    });

    client.on('connect', () => log.info('Redis connected'));
    client.on('error', (err) => log.error({ err }, 'Redis connection error'));
  }
  return client;
}

/**
 * Used by the readiness health check (BACKEND_ARCHITECTURE.md §50) — a
 * lightweight PING, never a real business-logic query. Wrapped in a hard
 * timeout as defense-in-depth: even if a future config change reintroduces
 * unbounded retry behavior, this function itself can never hang the
 * health check past ~2 seconds. The timer is always cleared, whichever
 * side of the race settles first, so it never lingers as an open handle
 * (visible to `jest --detectOpenHandles`) after the ping resolves.
 */
export async function pingRedis() {
  const redis = getRedisClient();
  let timer;
  try {
    const result = await Promise.race([
      redis.ping(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Redis ping timed out')),
          2000,
        );
      }),
    ]);
    return result === 'PONG';
  } finally {
    clearTimeout(timer);
  }
}

export async function closeRedisConnection() {
  if (client) {
    // disconnect() (not quit()) — quit() waits for a graceful QUIT reply
    // that may never arrive if the connection was never healthy in the
    // first place (e.g. Redis unreachable), which would otherwise hang
    // shutdown/test-teardown indefinitely.
    client.disconnect();
    client = undefined;
  }
}

export default getRedisClient;
