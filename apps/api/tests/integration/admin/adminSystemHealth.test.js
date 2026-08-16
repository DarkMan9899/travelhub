/**
 * Phase 11 Admin Platform (Stage 11.8): System Health — `GET
 * /admin/system-health`. Asserts RBAC (open to every admin-area role,
 * same as `GET /admin/dashboard` — no extra permission, unlike Audit
 * Logs; CUSTOMER is rejected by the outer `requireRole`) and the real
 * shape of the response against the real test-env MySQL/Redis/BullMQ
 * infra this suite already runs against.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import app from '../../../src/app.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';
import { DEV_CREDENTIALS } from '../../../src/infrastructure/database/seeds/005_dev_accounts.js';

let admin;
let customer;
let moderator;
let pool;

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
  pool = getMysqlPool();

  admin = await login(
    DEV_CREDENTIALS.admin.email,
    DEV_CREDENTIALS.admin.password,
  );
  customer = await login(
    DEV_CREDENTIALS.customer.email,
    DEV_CREDENTIALS.customer.password,
  );

  const registerRes = await request(app).post('/api/v1/auth/register').send({
    email: 'health.moderator@example.com',
    password: 'HealthModerator!2024',
    firstName: 'Health',
    lastName: 'Moderator',
  });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'MODERATOR'`,
    [registerRes.body.data.user.id],
  );
  moderator = await login(
    'health.moderator@example.com',
    'HealthModerator!2024',
  );
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /admin/system-health', () => {
  test('CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/system-health')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/system-health');
    expect(res.status).toBe(401);
  });

  test('MODERATOR can view (no extra permission required)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/system-health')
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(res.status).toBe(200);
  });

  test('ADMIN sees database/cache up, four queues, and environment/version', async () => {
    const res = await request(app)
      .get('/api/v1/admin/system-health')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        database: { status: 'up', latency_ms: expect.any(Number) },
        cache: { status: 'up', latency_ms: expect.any(Number) },
        environment: 'test',
        version: expect.any(String),
      }),
    );
    // Phase 13 adds `notifications.delivery`, Phase 17 adds
    // `availability.inventory-reconciliation-sweep`, alongside the two
    // original sweep-job queues.
    expect(res.body.data.queues).toHaveLength(4);
    expect(res.body.data.queues.map((queue) => queue.name)).toEqual(
      expect.arrayContaining([
        'booking-holds.expiry-sweep',
        'bookings.pending-vendor-sla-sweep',
        'notifications.delivery',
        'availability.inventory-reconciliation-sweep',
      ]),
    );
    res.body.data.queues.forEach((queue) => {
      expect(queue).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          status: 'up',
          waiting: expect.any(Number),
          active: expect.any(Number),
          delayed: expect.any(Number),
          failed: expect.any(Number),
        }),
      );
    });
  });
});
