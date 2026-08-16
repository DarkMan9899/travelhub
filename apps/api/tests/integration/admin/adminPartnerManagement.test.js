/**
 * Phase 11 Admin Platform (Stage 11.2): Partner Management —
 * `GET /partners/admin`, `GET /partners/admin/:id`,
 * `PATCH /partners/admin/:id/verification-status`,
 * `PATCH /partners/admin/:id/moderation-status`. Asserts RBAC across
 * SUPER_ADMIN (full access), MODERATOR (can read + moderate, cannot
 * verify — created here directly via SQL, since no dev account is
 * seeded for it), and CUSTOMER (denied), against real seeded data.
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
let vendorPartnerId;

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

  const [[partnerRow]] = await pool.query(
    'SELECT id FROM partners WHERE slug = ?',
    ['yerevan-boutique-hospitality'],
  );
  vendorPartnerId = partnerRow.id;

  // No dev account is seeded with MODERATOR — assign it directly to a
  // throwaway registered user, same pattern the Stage 11.1 SUPPORT test
  // uses.
  const registerRes = await request(app).post('/api/v1/auth/register').send({
    email: 'moderator.agent@example.com',
    password: 'ModeratorAgent!2024',
    firstName: 'Moderator',
    lastName: 'Agent',
  });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'MODERATOR'`,
    [registerRes.body.data.user.id],
  );
  moderator = await login('moderator.agent@example.com', 'ModeratorAgent!2024');
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /partners/admin (admin list)', () => {
  test('a SUPER_ADMIN receives a cursor-paginated list of real partners', async () => {
    const res = await request(app)
      .get('/api/v1/partners/admin')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        display_name: expect.any(String),
        verification_status: expect.any(String),
        moderation_status: expect.any(String),
      }),
    );
    expect(res.body.meta).toEqual(
      expect.objectContaining({ has_more: expect.any(Boolean) }),
    );
  });

  test('a keyword filter narrows to matching partners', async () => {
    const res = await request(app)
      .get('/api/v1/partners/admin?keyword=Yerevan Boutique')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: vendorPartnerId }),
      ]),
    );
  });

  test('MODERATOR (read + moderate, no verify) can list partners', async () => {
    const res = await request(app)
      .get('/api/v1/partners/admin')
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(res.status).toBe(200);
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .get('/api/v1/partners/admin')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /partners/admin/:id (admin detail)', () => {
  test('a SUPER_ADMIN sees the full admin-facing shape with owner + stats', async () => {
    const res = await request(app)
      .get(`/api/v1/partners/admin/${vendorPartnerId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: vendorPartnerId,
        slug: 'yerevan-boutique-hospitality',
        total_listing_count: expect.any(Number),
        published_listing_count: expect.any(Number),
        owner: expect.objectContaining({ email: 'vendor@travelhub.dev' }),
      }),
    );
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/partners/admin/${vendorPartnerId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /partners/admin/:id/verification-status (approve/reject)', () => {
  test('a SUPER_ADMIN can reject, then re-approve, verification — writes an audit log entry each time', async () => {
    const rejectRes = await request(app)
      .patch(`/api/v1/partners/admin/${vendorPartnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'REJECTED' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.verification_status).toBe('REJECTED');

    const approveRes = await request(app)
      .patch(`/api/v1/partners/admin/${vendorPartnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'APPROVED' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.verification_status).toBe('APPROVED');

    const [logs] = await pool.query(
      `SELECT action FROM audit_logs
       WHERE target_type = 'partner' AND target_id = ? AND action = 'partner.verification_status_changed'
       ORDER BY id DESC LIMIT 2`,
      [vendorPartnerId],
    );
    expect(logs.length).toBe(2);
  });

  test('MODERATOR is rejected with 403 — cannot make verification decisions', async () => {
    const res = await request(app)
      .patch(`/api/v1/partners/admin/${vendorPartnerId}/verification-status`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ status: 'REJECTED' });
    expect(res.status).toBe(403);
  });

  test('an invalid status is rejected with 422', async () => {
    const res = await request(app)
      .patch(`/api/v1/partners/admin/${vendorPartnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'FLAGGED' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /partners/admin/:id/moderation-status (suspend/restore)', () => {
  test('MODERATOR can suspend (FLAGGED), then restore (APPROVED) — writes an audit log entry each time', async () => {
    const suspendRes = await request(app)
      .patch(`/api/v1/partners/admin/${vendorPartnerId}/moderation-status`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ status: 'FLAGGED' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.moderation_status).toBe('FLAGGED');

    // A FLAGGED partner drops out of the public directory immediately.
    const directoryRes = await request(app).get(
      `/api/v1/partners/yerevan-boutique-hospitality`,
    );
    expect(directoryRes.status).toBe(404);

    const restoreRes = await request(app)
      .patch(`/api/v1/partners/admin/${vendorPartnerId}/moderation-status`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ status: 'APPROVED' });
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.moderation_status).toBe('APPROVED');

    const [logs] = await pool.query(
      `SELECT action FROM audit_logs
       WHERE target_type = 'partner' AND target_id = ? AND action = 'partner.moderation_status_changed'
       ORDER BY id DESC LIMIT 2`,
      [vendorPartnerId],
    );
    expect(logs.length).toBe(2);
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .patch(`/api/v1/partners/admin/${vendorPartnerId}/moderation-status`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ status: 'FLAGGED' });
    expect(res.status).toBe(403);
  });

  test('an invalid status is rejected with 422', async () => {
    const res = await request(app)
      .patch(`/api/v1/partners/admin/${vendorPartnerId}/moderation-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'PENDING' });
    expect(res.status).toBe(422);
  });
});
