/**
 * Phase 11 Admin Platform (Stage 11.1): User Management — `GET /users`,
 * `GET /users/:id`, `PATCH /users/:id/status`, plus the two composed
 * admin-scoped lookups a user's detail page needs
 * (`GET /bookings?customerId=`, `GET /partners/by-user/:userId`).
 * Asserts RBAC across SUPER_ADMIN (full access), SUPPORT (view-only —
 * created here directly via SQL, since no dev account is seeded for it),
 * and CUSTOMER (denied), against real seeded data.
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
let pool;
let vendorUserId;

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

  const [[vendorRow]] = await pool.query(
    'SELECT id FROM users WHERE normalized_email = ?',
    ['vendor@travelhub.dev'],
  );
  vendorUserId = vendorRow.id;

  // No dev account is seeded with SUPPORT — assign it directly to a
  // throwaway registered user, same pattern `005_dev_accounts.js`'s
  // `assignRole` uses.
  const registerRes = await request(app).post('/api/v1/auth/register').send({
    email: 'support.agent@example.com',
    password: 'SupportAgent!2024',
    firstName: 'Support',
    lastName: 'Agent',
  });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'SUPPORT'`,
    [registerRes.body.data.user.id],
  );
  support = await login('support.agent@example.com', 'SupportAgent!2024');
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /users (admin list)', () => {
  test('a SUPER_ADMIN receives a cursor-paginated list of real users', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        email: expect.any(String),
        status_code: expect.any(String),
        role_codes: expect.any(Array),
      }),
    );
    expect(res.body.meta).toEqual(
      expect.objectContaining({ has_more: expect.any(Boolean) }),
    );
  });

  test('a keyword filter narrows to matching users', async () => {
    const res = await request(app)
      .get('/api/v1/users?keyword=vendor@travelhub.dev')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'vendor@travelhub.dev' }),
      ]),
    );
  });

  test('SUPPORT (view-only) can list users', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${support.accessToken}`);
    expect(res.status).toBe(200);
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /users/:id (admin detail)', () => {
  test('a SUPER_ADMIN sees the full admin-facing shape', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${vendorUserId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: vendorUserId,
        email: 'vendor@travelhub.dev',
        status_code: 'ACTIVE',
        role_codes: expect.arrayContaining(['CUSTOMER']),
      }),
    );
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${vendorUserId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /users/:id/status (suspend/activate/ban)', () => {
  test('a SUPER_ADMIN can suspend, then reactivate, a user — writes an audit log entry each time', async () => {
    const suspendRes = await request(app)
      .patch(`/api/v1/users/${vendorUserId}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'SUSPENDED' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.status_code).toBe('SUSPENDED');

    const activateRes = await request(app)
      .patch(`/api/v1/users/${vendorUserId}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'ACTIVE' });
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.status_code).toBe('ACTIVE');

    const [logs] = await pool.query(
      `SELECT action FROM audit_logs
       WHERE target_type = 'user' AND target_id = ? AND action = 'user.status_changed'
       ORDER BY id DESC LIMIT 2`,
      [vendorUserId],
    );
    expect(logs.length).toBe(2);
  });

  test('SUPPORT (view-only) is rejected with 403 — cannot suspend', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${vendorUserId}/status`)
      .set('Authorization', `Bearer ${support.accessToken}`)
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(403);
  });

  test('PENDING_DELETION is rejected as not an admin-settable status', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${vendorUserId}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'PENDING_DELETION' });
    expect(res.status).toBe(422);
  });
});

describe('GET /bookings?customerId= (admin booking-history lookup)', () => {
  test('a SUPER_ADMIN can look up any customer’s bookings by id', async () => {
    const res = await request(app)
      .get(`/api/v1/bookings?customerId=${vendorUserId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('a CUSTOMER is rejected with 403 when passing an explicit customerId', async () => {
    const res = await request(app)
      .get(`/api/v1/bookings?customerId=${vendorUserId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /partners/by-user/:userId (admin partnership lookup)', () => {
  test('a SUPER_ADMIN sees the seeded vendor’s real partner membership', async () => {
    const res = await request(app)
      .get(`/api/v1/partners/by-user/${vendorUserId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'yerevan-boutique-hospitality',
          role: 'OWNER',
        }),
      ]),
    );
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/partners/by-user/${vendorUserId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});
