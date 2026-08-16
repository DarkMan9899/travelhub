/**
 * Test-only helper: clears two Redis-backed, cross-cutting counters
 * between integration test files.
 *
 * 1. Rate-limit counters (`src/middleware/rateLimiter.js`).
 *    `express-rate-limit`'s default key generator is IP-based, not
 *    per-test-file — every supertest request in this process shares one
 *    Redis bucket per tier regardless of which file issued it. Sprint 6's
 *    auth integration tests make many `/auth/register`/`login`/`refresh`
 *    calls (all under the `sensitive` tier, default 10/min) across
 *    several files; without resetting between files, a later file's
 *    requests would spuriously hit `RATE_LIMITED` because of an earlier
 *    file's calls. `ai` (Phase 15, `aiRateLimiter`, 20/min — the
 *    tightest tier) is included for the same reason: several AI
 *    integration test files each issue a handful of real AI-gateway
 *    calls, and without a reset a later file's calls could spuriously
 *    429 off an earlier file's usage within the same test run.
 *
 * 2. Login-attempt lockout counters (`LoginAttemptTracker`, keyspace
 *    `session:login_attempts:`) — 5 failures within 15 minutes locks
 *    that email out (`ACCOUNT_LOCKED`, 423), keyed by account, not IP.
 *    Any file intentionally testing a wrong-password scenario against a
 *    shared dev account (e.g. `authFlow.test.js`) could otherwise push
 *    that account toward the 5-attempt threshold and lock out every
 *    later file in the same run that needs to log in as it — the exact
 *    same "shared counter across files" hazard the rate-limit reset
 *    above already exists to prevent, just for a second Redis-backed
 *    guard.
 */

import {
  getRedisClient,
  REDIS_KEY_PREFIXES,
} from '../../../src/infrastructure/cache/redisClient.js';

export async function resetRateLimits() {
  const redis = getRedisClient();
  const tiers = ['public', 'authenticated', 'sensitive', 'ai'];
  const keys = (
    await Promise.all([
      ...tiers.map((tier) =>
        redis.keys(`${REDIS_KEY_PREFIXES.RATE_LIMIT}${tier}:*`),
      ),
      redis.keys(`${REDIS_KEY_PREFIXES.SESSION}login_attempts:*`),
    ])
  ).flat();
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export default resetRateLimits;
