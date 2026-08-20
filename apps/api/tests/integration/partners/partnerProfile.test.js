/**
 * P1.3 (Master Roadmap) — owner/staff company-profile management for an
 * already-APPROVED partner: `GET`/`PATCH /partners/:id/profile` and
 * `POST /partners/:id/logo`/`/cover`. Against the real HTTP API, real
 * database, no seed-data dependency — every partner here is created
 * fresh via the real P1.2 onboarding flow (create -> submit -> admin
 * approves), then a second staff user is added directly via
 * `partner_employees` (no "invite staff" endpoint exists yet — P1.4).
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
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
let pool;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

async function registerUser(label) {
  const email = `profile-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'ProfileFixture!2024',
    firstName: 'Profile',
    lastName: label,
  });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

/** Real onboarding flow (P1.2), approved by the seeded admin, so every test starts from a genuine APPROVED partner. */
async function createApprovedPartner(owner, displayName) {
  const createRes = await request(app)
    .post('/api/v1/partners/applications')
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send({
      displayName,
      legalName: `${displayName} LLC`,
      email: 'contact@example.com',
      phone: '+37400000099',
    });
  const partnerId = createRes.body.data.id;
  await request(app)
    .post(`/api/v1/partners/applications/${partnerId}/submit`)
    .set('Authorization', `Bearer ${owner.accessToken}`);
  await request(app)
    .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
    .set('Authorization', `Bearer ${admin.accessToken}`)
    .send({ status: 'APPROVED' });
  return partnerId;
}

async function addStaff(partnerId, userId, roleCode) {
  await pool.query(
    `INSERT INTO partner_employees (partner_id, user_id, role_id, created_by, updated_by)
     VALUES (?, ?, (SELECT id FROM partner_employee_roles WHERE code = ?), ?, ?)`,
    [partnerId, userId, roleCode, userId, userId],
  );
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
}, 60_000);

beforeEach(async () => {
  await resetRateLimits();
});

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Partner company profile management (P1.3)', () => {
  test('GET /partners/:id/profile requires authentication', async () => {
    const owner = await registerUser('getauth');
    const partnerId = await createApprovedPartner(owner, 'Auth Check Co');

    const res = await request(app).get(`/api/v1/partners/${partnerId}/profile`);
    expect(res.status).toBe(401);
  });

  test("the owner can update identity, contact info, social links, and one locale's description", async () => {
    const owner = await registerUser('happy');
    const partnerId = await createApprovedPartner(
      owner,
      'Sevan Lakeside Tours',
    );

    const updateRes = await request(app)
      .patch(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        displayName: 'Sevan Lakeside Tours LLC',
        email: 'hello@sevanlakeside.example',
        phone: '+37400000100',
        website: 'https://sevanlakeside.example',
        description: 'Guided boat tours on Lake Sevan.',
        locale: 'en',
        socialLinks: { facebook: 'https://facebook.com/sevanlakeside' },
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.display_name).toBe('Sevan Lakeside Tours LLC');
    expect(updateRes.body.data.social_links).toEqual({
      facebook: 'https://facebook.com/sevanlakeside',
    });
    const translation = updateRes.body.data.translations.find(
      (t) => t.language_code === 'en',
    );
    expect(translation.description).toBe('Guided boat tours on Lake Sevan.');

    // The public company page reflects the change immediately — no
    // caching layer, no separate "publish" step (per the roadmap's own
    // "verify the public page immediately reflects published changes").
    const [[row]] = await pool.query('SELECT slug FROM partners WHERE id = ?', [
      partnerId,
    ]);
    const publicRes = await request(app).get(`/api/v1/partners/${row.slug}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.display_name).toBe('Sevan Lakeside Tours LLC');
    expect(
      publicRes.body.data.translations.find((t) => t.language_code === 'en')
        .description,
    ).toBe('Guided boat tours on Lake Sevan.');

    const getRes = await request(app)
      .get(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.website).toBe('https://sevanlakeside.example');
  });

  test('description requires locale (422)', async () => {
    const owner = await registerUser('nolocale');
    const partnerId = await createApprovedPartner(owner, 'No Locale Co');

    const res = await request(app)
      .patch(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ description: 'Missing a locale.' });
    expect(res.status).toBe(422);
  });

  test("a stranger cannot read or write another partner's profile (403, existence not masked)", async () => {
    const owner = await registerUser('strangerowner');
    const stranger = await registerUser('stranger');
    const partnerId = await createApprovedPartner(owner, 'Stranger Test Co');

    const getRes = await request(app)
      .get(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(getRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ displayName: 'Hijacked' });
    expect(patchRes.status).toBe(403);
  });

  test('an EDITOR staff member can read but cannot write the profile (no MANAGE_COMPANY_PROFILE capability)', async () => {
    const owner = await registerUser('editorowner');
    const editor = await registerUser('editor');
    const partnerId = await createApprovedPartner(owner, 'Editor Test Co');
    await addStaff(partnerId, editor.userId, 'EDITOR');

    const getRes = await request(app)
      .get(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${editor.accessToken}`);
    expect(getRes.status).toBe(200);

    const patchRes = await request(app)
      .patch(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .send({ displayName: 'Should not apply' });
    expect(patchRes.status).toBe(403);
  });

  test('a MANAGER staff member can write the profile (has MANAGE_COMPANY_PROFILE)', async () => {
    const owner = await registerUser('managerowner');
    const manager = await registerUser('manager');
    const partnerId = await createApprovedPartner(owner, 'Manager Test Co');
    await addStaff(partnerId, manager.userId, 'MANAGER');

    const patchRes = await request(app)
      .patch(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ phone: '+37400000200' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.phone).toBe('+37400000200');
  });

  test('logo upload sets logo_url and is rejected for a non-image content type', async () => {
    const owner = await registerUser('logo');
    const partnerId = await createApprovedPartner(owner, 'Logo Test Co');

    // `express.raw({ type: ALLOWED_IMAGE_MIME_TYPES })` (module.routes.js)
    // never parses a `application/pdf` body into a Buffer at all — the
    // controller's own "non-empty file" guard is what actually rejects
    // this, before the request ever reaches the Service's MIME check.
    const badRes = await request(app)
      .post(`/api/v1/partners/${partnerId}/logo`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4'));
    expect(badRes.status).toBe(422);

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const res = await request(app)
      .post(`/api/v1/partners/${partnerId}/logo`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(pngBuffer);
    expect(res.status).toBe(200);
    // Local storage (this test env) returns a relative path, not an
    // absolute URL — only S3 does that. Just assert a real value landed.
    expect(res.body.data.logo_url).toEqual(expect.stringContaining('.png'));
  });
});
