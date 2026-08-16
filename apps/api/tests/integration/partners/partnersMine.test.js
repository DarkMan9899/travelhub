/**
 * Phase 5: `GET /partners/mine` — the only Partners-module endpoint this
 * phase adds. Built directly on the seeded partner/membership
 * (`seeds/005_dev_accounts.js`: `vendor@travelhub.dev` owns "Yerevan
 * Boutique Hospitality"), same fixture style as every other search/
 * listings integration suite.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import app from '../../../src/app.js';
import { closeMysqlPool } from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';
import { DEV_CREDENTIALS } from '../../../src/infrastructure/database/seeds/005_dev_accounts.js';

let vendor;
let customer;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { accessToken: res.body.data.access_token };
}

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();

  vendor = await login(
    DEV_CREDENTIALS.vendor.email,
    DEV_CREDENTIALS.vendor.password,
  );
  customer = await login(
    DEV_CREDENTIALS.customer.email,
    DEV_CREDENTIALS.customer.password,
  );
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /partners/mine', () => {
  test('returns the seeded partner membership for the vendor account, with role', async () => {
    const res = await request(app)
      .get('/api/v1/partners/mine')
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    expect(res.status).toBe(200);
    // The vendor account may also own/manage other partners created as
    // fixtures by other integration suites sharing this database
    // (e.g. rbac.test.js, listingCrud.test.js) — assert the seeded
    // membership is present rather than requiring an exact-array match.
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'yerevan-boutique-hospitality',
          display_name: 'Yerevan Boutique Hospitality',
          role: 'OWNER',
          partner_id: expect.any(Number),
        }),
      ]),
    );
  });

  test('returns an empty array for a user with no partner memberships', async () => {
    const res = await request(app)
      .get('/api/v1/partners/mine')
      .set('Authorization', `Bearer ${customer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/v1/partners/mine');
    expect(res.status).toBe(401);
  });
});
