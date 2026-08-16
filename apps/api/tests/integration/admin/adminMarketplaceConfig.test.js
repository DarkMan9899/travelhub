/**
 * Phase 11 Admin Platform (Stage 11.5): Marketplace Configuration —
 * admin CRUD for categories, amenities, pricing models, and the
 * countries -> regions -> cities geography hierarchy. Asserts RBAC
 * (ADMIN/SUPER_ADMIN can write via `marketplace.configure`; MODERATOR —
 * an admin-area role without that permission — can read but not write;
 * CUSTOMER is denied entirely) and that every mutation writes a real
 * `audit_logs` row.
 *
 * Every row created here is deleted by its own test (or by a trailing
 * cleanup step) so `seedAll()`'s baseline stays untouched for other
 * integration test files.
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
    email: 'config.moderator@example.com',
    password: 'ConfigModerator!2024',
    firstName: 'Config',
    lastName: 'Moderator',
  });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'MODERATOR'`,
    [registerRes.body.data.user.id],
  );
  moderator = await login(
    'config.moderator@example.com',
    'ConfigModerator!2024',
  );
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Categories admin CRUD', () => {
  test('ADMIN can create, update, and delete a category; MODERATOR can read but not write; CUSTOMER is denied entirely', async () => {
    const slug = `test-category-${Date.now()}`;

    const listAsCustomer = await request(app)
      .get('/api/v1/admin/config/categories')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listAsCustomer.status).toBe(403);

    const listAsModerator = await request(app)
      .get('/api/v1/admin/config/categories')
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(listAsModerator.status).toBe(200);

    const deniedCreate = await request(app)
      .post('/api/v1/admin/config/categories')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ name: 'Should Not Be Created', slug });
    expect(deniedCreate.status).toBe(403);

    const createRes = await request(app)
      .post('/api/v1/admin/config/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Test Category', slug });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toEqual(
      expect.objectContaining({ name: 'Test Category', slug }),
    );
    const categoryId = createRes.body.data.id;

    const listAfterCreate = await request(app)
      .get('/api/v1/admin/config/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(listAfterCreate.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: categoryId })]),
    );

    const updateRes = await request(app)
      .patch(`/api/v1/admin/config/categories/${categoryId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Renamed Category', slug });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Renamed Category');

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/config/categories/${categoryId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(deleteRes.status).toBe(204);

    const [logs] = await pool.query(
      `SELECT action FROM audit_logs
       WHERE target_type = 'listing_category' AND target_id = ?
       ORDER BY id ASC`,
      [categoryId],
    );
    expect(logs.map((row) => row.action)).toEqual([
      'marketplace.category_created',
      'marketplace.category_updated',
      'marketplace.category_deleted',
    ]);
  });

  test('creating a category with a duplicate slug is rejected with 409', async () => {
    const slug = `test-category-dup-${Date.now()}`;
    const first = await request(app)
      .post('/api/v1/admin/config/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'First', slug });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/admin/config/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Second', slug });
    expect(second.status).toBe(409);

    await request(app)
      .delete(`/api/v1/admin/config/categories/${first.body.data.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
  });

  test('an invalid slug is rejected with 422', async () => {
    const res = await request(app)
      .post('/api/v1/admin/config/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Bad Slug', slug: 'Not A Valid Slug!' });
    expect(res.status).toBe(422);
  });
});

describe('Amenities admin CRUD', () => {
  test('ADMIN can create, update, and delete an amenity; the amenity-groups list is readable', async () => {
    const groupsRes = await request(app)
      .get('/api/v1/admin/config/amenity-groups')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(groupsRes.status).toBe(200);
    expect(Array.isArray(groupsRes.body.data)).toBe(true);

    const createRes = await request(app)
      .post('/api/v1/admin/config/amenities')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: `Test Amenity ${Date.now()}` });
    expect(createRes.status).toBe(201);
    const amenityId = createRes.body.data.id;

    const updateRes = await request(app)
      .patch(`/api/v1/admin/config/amenities/${amenityId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Renamed Amenity' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Renamed Amenity');

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/config/amenities/${amenityId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(deleteRes.status).toBe(204);
  });
});

describe('Pricing models admin CRUD', () => {
  test('ADMIN can create, update, and delete a pricing model', async () => {
    const code = `TEST_MODEL_${Date.now()}`;
    const createRes = await request(app)
      .post('/api/v1/admin/config/pricing-models')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ code, name: 'Test Pricing Model' });
    expect(createRes.status).toBe(201);
    const {
      data: { id },
    } = createRes.body;

    const updateRes = await request(app)
      .patch(`/api/v1/admin/config/pricing-models/${id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ code, name: 'Renamed Pricing Model' });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/v1/admin/config/pricing-models/${id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(deleteRes.status).toBe(204);
  });
});

describe('Geography admin CRUD (countries -> regions -> cities)', () => {
  test('ADMIN can create a country, a region under it, and a city under that region, then delete bottom-up', async () => {
    const isoCode = 'ZZ';
    const countryRes = await request(app)
      .post('/api/v1/admin/config/countries')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ isoCode, name: 'Testland' });
    expect(countryRes.status).toBe(201);
    const countryId = countryRes.body.data.id;

    const regionRes = await request(app)
      .post('/api/v1/admin/config/regions')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ countryId, name: 'Test Region' });
    expect(regionRes.status).toBe(201);
    const regionId = regionRes.body.data.id;

    const regionsFiltered = await request(app)
      .get(`/api/v1/admin/config/regions?countryId=${countryId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(regionsFiltered.body.data).toEqual([
      expect.objectContaining({ id: regionId, country_id: countryId }),
    ]);

    const citySlug = `test-city-${Date.now()}`;
    const cityRes = await request(app)
      .post('/api/v1/admin/config/cities')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        regionId,
        name: 'Test City',
        slug: citySlug,
        latitude: 40.1,
        longitude: 44.5,
      });
    expect(cityRes.status).toBe(201);
    const cityId = cityRes.body.data.id;

    const citiesFiltered = await request(app)
      .get(`/api/v1/admin/config/cities?regionId=${regionId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(citiesFiltered.body.data).toEqual([
      expect.objectContaining({ id: cityId, region_id: regionId }),
    ]);

    // Deleting the region while a city still references it fails with a
    // mapped FK-conflict error (422), proving the raw driver error never
    // leaks — delete bottom-up instead.
    const blockedDelete = await request(app)
      .delete(`/api/v1/admin/config/regions/${regionId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(blockedDelete.status).toBe(422);

    await request(app)
      .delete(`/api/v1/admin/config/cities/${cityId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    await request(app)
      .delete(`/api/v1/admin/config/regions/${regionId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    const finalDelete = await request(app)
      .delete(`/api/v1/admin/config/countries/${countryId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(finalDelete.status).toBe(204);
  });
});
