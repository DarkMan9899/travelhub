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

/**
 * Shared by the autouse `page` fixture below AND callable directly from
 * inside a spec — a handful of specs (e.g. `partnerProfile.spec.js`'s
 * happy path: register -> admin login -> owner re-login, all against the
 * `sensitive` tier's real 10/min production ceiling) legitimately chain
 * enough auth calls within ONE test to exhaust a budget that's only ever
 * flushed once, at that test's start.
 */
export async function resetRateLimits() {
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
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await resetRateLimits();
    await use(page);
  },
});

const API_BASE = 'http://localhost:4000/api/v1/';

/**
 * Resolves a listing's seeded review id/content at test-run time instead
 * of hardcoding them. `seedDemoMarketplace.js` assigns each review's
 * template by the reviewed booking's position in a loop over ALL
 * completed demo bookings, not by listing identity — a reseed can
 * therefore attach a different template (different id, different body
 * text) to the same listing than an earlier reseed did (found via a P2.1
 * acceptance-verification reseed: listing 37's review body and id both
 * changed between runs). Mirrors `inventory.spec.js`'s own
 * `resolveListingId` pattern for the identical reason — resolve the
 * unstable value from the real API instead of assuming it.
 */
export async function resolveSeededReview(requestContext, listingId) {
  const res = await requestContext.get(
    `${API_BASE}reviews?listingId=${listingId}&limit=1`,
  );
  const { data } = await res.json();
  return { id: data[0].id, text: data[0].content };
}

export { expect, request };
