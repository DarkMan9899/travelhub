/**
 * Phase 11 Admin Platform: `GET /admin/dashboard` — the first real Admin
 * module endpoint. Asserts RBAC gating (SUPER_ADMIN in, CUSTOMER out,
 * unauthenticated out) and the response shape, against real seeded data.
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

let admin;
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

  admin = await login(
    DEV_CREDENTIALS.admin.email,
    DEV_CREDENTIALS.admin.password,
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

describe('GET /admin/dashboard', () => {
  test('a SUPER_ADMIN receives dashboard stats composed from real tables', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.counts).toEqual({
      users: expect.any(Number),
      partners: expect.any(Number),
      listings: expect.any(Number),
      published_listings: expect.any(Number),
      bookings: expect.any(Number),
      completed_bookings: expect.any(Number),
    });
    expect(res.body.data.counts.users).toBeGreaterThan(0);
    expect(res.body.data.counts.partners).toBeGreaterThan(0);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        pending_actions: {
          pending_partners: expect.any(Number),
          pending_listings: expect.any(Number),
          pending_bookings: expect.any(Number),
        },
        booking_value_by_currency: expect.any(Array),
        bookings_by_day: expect.any(Array),
        recent_activity: expect.any(Array),
      }),
    );
  });

  test('a CUSTOMER (no admin-area role) is rejected with 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customer.accessToken}`);

    expect(res.status).toBe(403);
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });
});
