/**
 * Phase 10 (redesign): `GET /partners` (Companies directory) and
 * `GET /partners/:slug` (Company profile) — the module's first PUBLIC
 * reads, built on the seeded, APPROVED partner
 * (`seeds/005_dev_accounts.js`: "Yerevan Boutique Hospitality",
 * `yerevan-boutique-hospitality`).
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import app from '../../../src/app.js';
import { closeMysqlPool } from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /partners (Companies directory)', () => {
  test('is public, no auth required, and lists the seeded approved partner', async () => {
    // `ORDER BY p.id DESC` (mysqlPartnerRepository.js#listPublic) — the
    // seeded partner has a low, fixed id, so it is NOT necessarily on
    // page 1 once other integration test files (each creating their own
    // real, APPROVED partners via the P1.2 onboarding flow) have run
    // first in the same suite. Paginating to the end instead of
    // asserting page-1 membership is what actually verifies the
    // endpoint works, independent of run order/how many partners other
    // files created before this one.
    let found;
    let cursor;
    let meta;
    do {
      // eslint-disable-next-line no-await-in-loop -- sequential pagination walk, not a hot path
      const res = await request(app)
        .get('/api/v1/partners')
        .query({ limit: 100, ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      found = res.body.data.find(
        (row) => row.slug === 'yerevan-boutique-hospitality',
      );
      meta = res.body.meta;
      cursor = meta.next_cursor;
    } while (!found && meta.has_more);

    expect(found).toEqual(
      expect.objectContaining({
        slug: 'yerevan-boutique-hospitality',
        display_name: 'Yerevan Boutique Hospitality',
        is_verified: true,
        listing_count: expect.any(Number),
      }),
    );
    expect(meta).toEqual(
      expect.objectContaining({
        has_more: expect.any(Boolean),
        limit: expect.any(Number),
      }),
    );
  });

  test('supports a limit query param', async () => {
    const res = await request(app).get('/api/v1/partners?limit=1');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });
});

describe('GET /partners/:slug (Company profile)', () => {
  test('returns the seeded partner detail by slug, no auth required', async () => {
    const res = await request(app).get(
      '/api/v1/partners/yerevan-boutique-hospitality',
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        slug: 'yerevan-boutique-hospitality',
        display_name: 'Yerevan Boutique Hospitality',
        is_verified: true,
        listing_count: expect.any(Number),
        social_links: expect.any(Object),
      }),
    );
  });

  test('returns 404 for an unknown slug', async () => {
    const res = await request(app).get(
      '/api/v1/partners/not-a-real-company-slug',
    );
    expect(res.status).toBe(404);
  });
});
