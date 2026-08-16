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
 * Deliberately does NOT run with the RATE_LIMIT_*_PER_MINUTE overrides the
 * rest of the suite uses to avoid rate-limit interference — this file
 * needs the real default limits (public=20/min, authenticated=300/min) to
 * observe the tiering behavior at all.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import app from '../../../src/app.js';
import { closeMysqlPool } from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

beforeAll(async () => {
  await up();
  await seedAll();
}, 60_000);

afterAll(async () => {
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
