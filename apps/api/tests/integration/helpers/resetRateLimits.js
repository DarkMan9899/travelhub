/**
 * Test-only helper: clears the Redis-backed rate-limit counters
 * (`src/middleware/rateLimiter.js`) between integration test files.
 *
 * `express-rate-limit`'s default key generator is IP-based, not
 * per-test-file — every supertest request in this process shares one
 * Redis bucket per tier regardless of which file issued it. Sprint 6's
 * auth integration tests make many `/auth/register`/`login`/`refresh`
 * calls (all under the `sensitive` tier, default 10/min) across several
 * files; without resetting between files, a later file's requests would
 * spuriously hit `RATE_LIMITED` because of an earlier file's calls, not
 * because of anything the later file is actually testing.
 */

import {
  getRedisClient,
  REDIS_KEY_PREFIXES,
} from '../../../src/infrastructure/cache/redisClient.js';

export async function resetRateLimits() {
  const redis = getRedisClient();
  const tiers = ['public', 'authenticated', 'sensitive'];
  const keys = (
    await Promise.all(
      tiers.map((tier) =>
        redis.keys(`${REDIS_KEY_PREFIXES.RATE_LIMIT}${tier}:*`),
      ),
    )
  ).flat();
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export default resetRateLimits;
