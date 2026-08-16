/**
 * Playwright global setup — flushes two Redis-backed, cross-cutting
 * counters once before the full E2E suite runs, both keyed in a way that's
 * shared across every spec file regardless of which one issued the
 * requests:
 *
 * 1. Rate-limit counters (`apps/api/src/middleware/rateLimiter.js`,
 *    keyspace prefix `ratelimit:`). `express-rate-limit`'s key generator
 *    is IP-based, not per-test-file — every request from this machine
 *    shares one Redis bucket per tier. The `ai` tier (Stage 15.0's
 *    `aiRateLimiter`, a deliberately hardcoded 20/min cost-control
 *    ceiling, never raised for testing) is the tightest: `ai.spec.js`
 *    alone makes several real AI-gateway calls, and running it alongside
 *    every other spec in one `fullyParallel` run can otherwise exhaust
 *    that budget before `ai.spec.js`'s own tests get their turn.
 *
 * 2. Login-attempt lockout counters (`LoginAttemptTracker`, keyspace
 *    prefix `session:login_attempts:`) — 5 failures within 15 minutes
 *    locks that email out (`ACCOUNT_LOCKED`, 423), keyed by account, not
 *    IP. `auth.spec.js`'s deliberate "wrong password" test (and any
 *    other spec's failed-login assertions) run against the same shared
 *    demo/dev accounts every other spec logs into — without a flush here,
 *    those failures can push a real account over the 5-attempt threshold
 *    and lock out every unrelated spec that needs that account for the
 *    rest of the run. Found via a real cascading-failure investigation,
 *    not a hypothetical: a full-suite run without this flush showed the
 *    exact `ACCOUNT_LOCKED` (423) signature across nearly every spec that
 *    logs in.
 *
 * Mirrors `apps/api/tests/integration/helpers/resetRateLimits.js`'s
 * identical fix for the backend integration suite (same two prefixes).
 */

import Redis from 'ioredis';

export default async function globalSetup() {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    const keys = (
      await Promise.all([
        redis.keys('ratelimit:*'),
        redis.keys('session:login_attempts:*'),
      ])
    ).flat();
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Redis unavailable — the app's own rate limiter already fails open
    // in that case (see `failOpenOnStoreError` in rateLimiter.js), and
    // `LoginAttemptTracker` fails open too (never blocks login on a
    // tracker outage); a stale/unreachable counter here is likewise not
    // worth failing the whole E2E run over.
  } finally {
    redis.disconnect();
  }
}
