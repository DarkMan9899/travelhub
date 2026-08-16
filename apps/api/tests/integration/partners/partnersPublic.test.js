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
    const res = await request(app).get('/api/v1/partners');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'yerevan-boutique-hospitality',
          display_name: 'Yerevan Boutique Hospitality',
          is_verified: true,
          listing_count: expect.any(Number),
        }),
      ]),
    );
    expect(res.body.meta).toEqual(
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
