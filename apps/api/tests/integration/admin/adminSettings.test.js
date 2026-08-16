/**
 * Phase 11 Admin Platform (Stage 11.9): Settings — admin CRUD for
 * `system_settings` (generic key/JSON-value store) and `feature_flags`
 * (named boolean toggles). Asserts RBAC (ADMIN/SUPER_ADMIN can write via
 * `settings.manage`; MODERATOR — an admin-area role without that
 * permission — can read but not write; CUSTOMER is denied entirely) and
 * that every mutation writes a real `audit_logs` row.
 *
 * Every row created here is deleted by its own test so the seeded
 * baseline (`009_settings_and_feature_flags.js`) stays untouched for
 * other integration test files.
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
    email: 'settings.moderator@example.com',
    password: 'SettingsModerator!2024',
    firstName: 'Settings',
    lastName: 'Moderator',
  });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'MODERATOR'`,
    [registerRes.body.data.user.id],
  );
  moderator = await login(
    'settings.moderator@example.com',
    'SettingsModerator!2024',
  );
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('System settings admin CRUD', () => {
  test('lists the seeded settings', async () => {
    const res = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'site_name',
          value: 'desavii',
        }),
      ]),
    );
  });

  test('ADMIN can create, update, and delete a setting; MODERATOR can read but not write; CUSTOMER is denied entirely', async () => {
    const key = `test_setting_${Date.now()}`;

    const listAsCustomer = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listAsCustomer.status).toBe(403);

    const listAsModerator = await request(app)
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(listAsModerator.status).toBe(200);

    const deniedCreate = await request(app)
      .post('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ key, value: 'should not be created' });
    expect(deniedCreate.status).toBe(403);

    const createRes = await request(app)
      .post('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ key, value: { nested: true }, description: 'A test setting' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toEqual(
      expect.objectContaining({ key, value: { nested: true } }),
    );
    const settingId = createRes.body.data.id;

    const updateRes = await request(app)
      .patch(`/api/v1/admin/settings/${settingId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ key, value: 'updated value' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.value).toBe('updated value');

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/settings/${settingId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(deleteRes.status).toBe(204);

    const [logs] = await pool.query(
      `SELECT action FROM audit_logs
       WHERE target_type = 'system_setting' AND target_id = ?
       ORDER BY id ASC`,
      [settingId],
    );
    expect(logs.map((row) => row.action)).toEqual([
      'settings.setting_created',
      'settings.setting_updated',
      'settings.setting_deleted',
    ]);
  });

  test('creating a setting with a duplicate key is rejected with 409', async () => {
    const key = `test_setting_dup_${Date.now()}`;
    const first = await request(app)
      .post('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ key, value: 'first' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ key, value: 'second' });
    expect(second.status).toBe(409);

    await request(app)
      .delete(`/api/v1/admin/settings/${first.body.data.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
  });

  test('an invalid key is rejected with 422', async () => {
    const res = await request(app)
      .post('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ key: 'Not A Valid Key!', value: 'x' });
    expect(res.status).toBe(422);
  });
});

describe('Feature flags admin CRUD', () => {
  test('lists the seeded flags, all disabled', async () => {
    const res = await request(app)
      .get('/api/v1/admin/feature-flags')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'maintenance_mode',
          is_enabled: false,
        }),
      ]),
    );
  });

  test('ADMIN can create, toggle, and delete a flag; MODERATOR can read but not write', async () => {
    const code = `test_flag_${Date.now()}`;

    const deniedCreate = await request(app)
      .post('/api/v1/admin/feature-flags')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ code, name: 'Should Not Be Created' });
    expect(deniedCreate.status).toBe(403);

    const createRes = await request(app)
      .post('/api/v1/admin/feature-flags')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ code, name: 'Test Flag', isEnabled: false });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toEqual(
      expect.objectContaining({ code, is_enabled: false }),
    );
    const flagId = createRes.body.data.id;

    const toggleRes = await request(app)
      .patch(`/api/v1/admin/feature-flags/${flagId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ code, name: 'Test Flag', isEnabled: true });
    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.is_enabled).toBe(true);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/feature-flags/${flagId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(deleteRes.status).toBe(204);

    const [logs] = await pool.query(
      `SELECT action FROM audit_logs
       WHERE target_type = 'feature_flag' AND target_id = ?
       ORDER BY id ASC`,
      [flagId],
    );
    expect(logs.map((row) => row.action)).toEqual([
      'settings.feature_flag_created',
      'settings.feature_flag_updated',
      'settings.feature_flag_deleted',
    ]);
  });

  test('creating a flag with a duplicate code is rejected with 409', async () => {
    const code = `test_flag_dup_${Date.now()}`;
    const first = await request(app)
      .post('/api/v1/admin/feature-flags')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ code, name: 'First' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/admin/feature-flags')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ code, name: 'Second' });
    expect(second.status).toBe(409);

    await request(app)
      .delete(`/api/v1/admin/feature-flags/${first.body.data.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
  });
});
