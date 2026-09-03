/**
 * Phase 11 pre-flight verification: `authenticatedRateLimiter` is fully
 * implemented (src/middleware/rateLimiter.js) but was never actually
 * applied anywhere — every request, authenticated or not, was capped at
 * the public tier's default 20/min. app.js's global rate-limit middleware
 * now selects the tier based on whether `req.principal` was resolved by
 * the authenticate middleware that already ran before it. This test
 * proves both halves of that fix: an anonymous burst still gets throttled
 * at the public ceiling, and an authenticated burst of the same size does
 * not, because it's judged against the higher authenticated ceiling.
 *
 * Deliberately does NOT run with the RATE_LIMIT_*_PER_MINUTE overrides
 * `package.json`'s `test:integration`/`test:contract` scripts set for the
 * rest of the suite (test-readiness remediation, 2026 — those scripts set
 * generous ceilings so that the other ~130 integration files' combined
 * request volume never collides on the real, tight production limits) —
 * this file needs the real production default limits (public=20/min,
 * authenticated=300/min, from `.env`/config's own defaults) to observe
 * the tiering behavior at all, so it force-overrides those two env vars
 * back down for itself before `app.js`/`config/index.js` ever evaluates
 * them, using the same file-scoped dynamic-import opt-out pattern
 * `paymentsDisabledGate.test.js` established for `PAYMENTS_ENABLED`.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

let up;
let seedAll;
let app;
let closeMysqlPool;
let closeRedisConnection;
let resetRateLimits;

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

beforeAll(async () => {
  process.env.RATE_LIMIT_PUBLIC_PER_MINUTE = '20';
  process.env.RATE_LIMIT_AUTHENTICATED_PER_MINUTE = '300';

  ({ up } = await import('../../../src/infrastructure/database/migrate.js'));
  ({ seedAll } =
    await import('../../../src/infrastructure/database/seeds/index.js'));
  ({ default: app } = await import('../../../src/app.js'));
  ({ closeMysqlPool } =
    await import('../../../src/infrastructure/database/mysqlPool.js'));
  ({ closeRedisConnection } =
    await import('../../../src/infrastructure/cache/redisClient.js'));
  ({ resetRateLimits } = await import('../helpers/resetRateLimits.js'));

  await up();
  await seedAll();
}, 60_000);

afterAll(async () => {
  delete process.env.RATE_LIMIT_PUBLIC_PER_MINUTE;
  delete process.env.RATE_LIMIT_AUTHENTICATED_PER_MINUTE;
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Rate-limit tiering (public vs. authenticated)', () => {
  test('an anonymous burst above the public ceiling (20/min) is throttled', async () => {
    await resetRateLimits();

    const responses = [];
    // eslint-disable-next-line no-restricted-syntax -- requests must land in order to observe the tier boundary
    for (let i = 0; i < 25; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      responses.push(await request(app).get('/api/v1/search'));
    }

    expect(responses.some((res) => res.status === 429)).toBe(true);
  }, 30_000);

  test('an authenticated burst of the same size (25 requests) is not throttled, because it is judged against the higher authenticated ceiling (300/min)', async () => {
    await resetRateLimits();

    const email = uniqueEmail('rate-limit-tier');
    const password = 'StrongPass!2024';
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'Tier', lastName: 'Test' });
    const { access_token: accessToken } = registerRes.body.data;

    await resetRateLimits();

    const responses = [];
    // eslint-disable-next-line no-restricted-syntax -- requests must land in order to observe the tier boundary
    for (let i = 0; i < 25; i += 1) {
      responses.push(
        // eslint-disable-next-line no-await-in-loop -- sequential by design
        await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${accessToken}`),
      );
    }

    expect(responses.every((res) => res.status === 200)).toBe(true);
  }, 30_000);
});
