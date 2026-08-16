/**
 * Phase 11 Admin Platform (Stage 11.6): CMS — the public
 * `GET /cms/pages/:slug` read (built correctly but not yet consumed by
 * any frontend page, per the Phase 11 plan's own scope decision), and
 * admin CRUD (`GET/POST/PATCH/DELETE /cms/admin/pages`,
 * `PUT /cms/admin/pages/:id/translations/:languageCode`) gated by
 * `cms.manage`. Asserts RBAC (ADMIN/SUPER_ADMIN write, MODERATOR reads
 * but cannot write, CUSTOMER denied entirely) and that every mutation
 * writes a real `audit_logs` row.
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
    email: 'cms.moderator@example.com',
    password: 'CmsModerator!2024',
    firstName: 'Cms',
    lastName: 'Moderator',
  });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'MODERATOR'`,
    [registerRes.body.data.user.id],
  );
  moderator = await login('cms.moderator@example.com', 'CmsModerator!2024');
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /cms/pages/:slug (public)', () => {
  test('returns the real seeded English content for a published page', async () => {
    const res = await request(app).get('/api/v1/cms/pages/about?locale=en');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        slug: 'about',
        language_code: 'en',
        title: 'About desavii',
      }),
    );
  });

  test('returns the Armenian content when locale=hy', async () => {
    const res = await request(app).get('/api/v1/cms/pages/about?locale=hy');
    expect(res.status).toBe(200);
    expect(res.body.data.language_code).toBe('hy');
  });

  test('an unpublished page (blog) 404s even though it has content', async () => {
    const res = await request(app).get('/api/v1/cms/pages/blog?locale=en');
    expect(res.status).toBe(404);
  });

  test('an unknown slug 404s', async () => {
    const res = await request(app).get(
      '/api/v1/cms/pages/does-not-exist?locale=en',
    );
    expect(res.status).toBe(404);
  });

  test('requires no authentication', async () => {
    const res = await request(app).get('/api/v1/cms/pages/faq?locale=en');
    expect(res.status).toBe(200);
  });
});

describe('Admin CMS CRUD', () => {
  test('ADMIN can list, create, update, upsert a translation, and delete; MODERATOR can read but not write; CUSTOMER is denied entirely', async () => {
    const listAsCustomer = await request(app)
      .get('/api/v1/cms/admin/pages')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listAsCustomer.status).toBe(403);

    const listAsAdmin = await request(app)
      .get('/api/v1/cms/admin/pages')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(listAsAdmin.status).toBe(200);
    expect(listAsAdmin.body.data.length).toBeGreaterThanOrEqual(6);

    const slug = `test-page-${Date.now()}`;
    const deniedCreate = await request(app)
      .post('/api/v1/cms/admin/pages')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ slug });
    expect(deniedCreate.status).toBe(403);

    const createRes = await request(app)
      .post('/api/v1/cms/admin/pages')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ slug, isPublished: false });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toEqual(
      expect.objectContaining({ slug, is_published: false }),
    );
    const pageId = createRes.body.data.id;

    const detailAsModerator = await request(app)
      .get(`/api/v1/cms/admin/pages/${pageId}`)
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(detailAsModerator.status).toBe(200);
    expect(detailAsModerator.body.data.translations).toEqual([]);

    const upsertRes = await request(app)
      .put(`/api/v1/cms/admin/pages/${pageId}/translations/en`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ title: 'Test Page', content: 'Test content body.' });
    expect(upsertRes.status).toBe(200);
    expect(upsertRes.body.data).toEqual([
      expect.objectContaining({
        language_code: 'en',
        title: 'Test Page',
        content: 'Test content body.',
      }),
    ]);

    const updateRes = await request(app)
      .patch(`/api/v1/cms/admin/pages/${pageId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ slug, isPublished: true });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.is_published).toBe(true);

    const publicRes = await request(app).get(
      `/api/v1/cms/pages/${slug}?locale=en`,
    );
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.title).toBe('Test Page');

    const deleteRes = await request(app)
      .delete(`/api/v1/cms/admin/pages/${pageId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(deleteRes.status).toBe(204);

    const [logs] = await pool.query(
      `SELECT action FROM audit_logs
       WHERE target_type = 'cms_page' AND target_id = ?
       ORDER BY id ASC`,
      [pageId],
    );
    expect(logs.map((row) => row.action)).toEqual([
      'cms.page_created',
      'cms.page_translation_updated',
      'cms.page_updated',
      'cms.page_deleted',
    ]);
  });

  test('creating a page with a duplicate slug is rejected with 409', async () => {
    const res = await request(app)
      .post('/api/v1/cms/admin/pages')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ slug: 'about' });
    expect(res.status).toBe(409);
  });

  test('upserting a translation with an unknown language code is rejected with 422', async () => {
    const [[aboutPage]] = await pool.query(
      "SELECT id FROM cms_pages WHERE slug = 'about'",
    );
    const res = await request(app)
      .put(`/api/v1/cms/admin/pages/${aboutPage.id}/translations/xx`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ title: 'Bad', content: 'Bad content.' });
    expect(res.status).toBe(422);
  });
});
