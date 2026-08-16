/**
 * Wraps `@playwright/test`'s `test` with an autouse fixture that flushes
 * the same two Redis-backed, IP/account-keyed counters `globalSetup.js`
 * flushes once for the whole run — rate-limit buckets (`ratelimit:*`,
 * `sensitive` tier default 10/min) and login-attempt lockout counters
 * (`session:login_attempts:*`). A once-per-run flush isn't enough here:
 * this suite has ~15 spec files that each log in at least once, all from
 * the same local IP, so the `sensitive` tier's budget is exhausted well
 * before the run finishes even with a single worker. Flushing before
 * every test (mirrors `apps/api/tests/integration/helpers/resetRateLimits.js`,
 * which the backend integration suite calls per file for the identical
 * reason) keeps the real rate limiter intact — its production-appropriate
 * threshold is never weakened — while unblocking local full-suite runs.
 */

import { test as base, expect, request } from '@playwright/test';
import Redis from 'ioredis';

export const test = base.extend({
  page: async ({ page }, use) => {
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
    } finally {
      redis.disconnect();
    }
    await use(page);
  },
});

export { expect, request };
