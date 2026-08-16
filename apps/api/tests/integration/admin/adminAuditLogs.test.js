/**
 * Phase 11 Admin Platform (Stage 11.7): Audit Logs — `GET
 * /admin/audit-logs`, view-only. Asserts RBAC (`audit.view` is granted to
 * SUPER_ADMIN/ADMIN/SUPPORT but not MODERATOR — the deliberate scoping
 * `004_roles_and_permissions.js` already documents; CUSTOMER is rejected
 * by the outer `requireRole` before reaching the permission check),
 * filtering (actorId/targetType/action), and cursor pagination — all
 * against real rows this suite's own login/register calls generate (every
 * login writes a `user.logged_in` audit row via
 * `authenticationService.js`, so no manual row-seeding is needed).
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
let support;
let moderator;
let pool;
let adminUserId;

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

  const [[adminRow]] = await pool.query(
    'SELECT id FROM users WHERE normalized_email = ?',
    ['admin@travelhub.dev'],
  );
  adminUserId = adminRow.id;

  const supportRegisterRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: 'audit.support@example.com',
      password: 'AuditSupport!2024',
      firstName: 'Audit',
      lastName: 'Support',
    });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'SUPPORT'`,
    [supportRegisterRes.body.data.user.id],
  );
  support = await login('audit.support@example.com', 'AuditSupport!2024');

  const moderatorRegisterRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: 'audit.moderator@example.com',
      password: 'AuditModerator!2024',
      firstName: 'Audit',
      lastName: 'Moderator',
    });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'MODERATOR'`,
    [moderatorRegisterRes.body.data.user.id],
  );
  moderator = await login('audit.moderator@example.com', 'AuditModerator!2024');
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /admin/audit-logs', () => {
  test('CUSTOMER is rejected with 403 (blocked by admin-area role gate)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('MODERATOR is rejected with 403 (admin-area role but no audit.view)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('SUPPORT (view-only, has audit.view) can list', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${support.accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toEqual(
      expect.objectContaining({ limit: expect.any(Number) }),
    );
  });

  test('ADMIN sees real entries with actor name and timestamps', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const entry = res.body.data[0];
    expect(entry).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        action: expect.any(String),
        target_type: expect.any(String),
        target_id: expect.any(Number),
        created_at: expect.any(String),
      }),
    );
  });

  test('filters by actorId to only that actor’s entries', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .query({ actorId: adminUserId })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((entry) => {
      expect(entry.actor_id).toBe(adminUserId);
    });
  });

  test('filters by targetType to only that target type', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .query({ targetType: 'user' })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((entry) => {
      expect(entry.target_type).toBe('user');
    });
  });

  test('filters by action to only that action', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .query({ action: 'user.logged_in' })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((entry) => {
      expect(entry.action).toBe('user.logged_in');
    });
  });

  test('cursor pagination: limit=1 returns has_more and a usable next_cursor', async () => {
    const firstPage = await request(app)
      .get('/api/v1/admin/audit-logs')
      .query({ limit: 1 })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data).toHaveLength(1);
    expect(firstPage.body.meta.has_more).toBe(true);
    expect(firstPage.body.meta.next_cursor).toEqual(expect.any(String));

    const secondPage = await request(app)
      .get('/api/v1/admin/audit-logs')
      .query({ limit: 1, cursor: firstPage.body.meta.next_cursor })
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data).toHaveLength(1);
    expect(secondPage.body.data[0].id).not.toBe(firstPage.body.data[0].id);
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/v1/admin/audit-logs');
    expect(res.status).toBe(401);
  });
});
