/**
 * Phase 11 Admin Platform (Stage 11.3): Listing Moderation —
 * `GET /listings/admin`, `GET /listings/admin/:id`,
 * `PATCH /listings/admin/:id/moderation-status`. Asserts RBAC across
 * SUPER_ADMIN (full access), MODERATOR (has `listing.moderate` per the
 * seeded role catalog), and a CUSTOMER (denied), against a real listing
 * created via the public listing-creation endpoint (same fixture pattern
 * `listingCrud.test.js` uses).
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
let vendor;
let moderator;
let pool;
let partnerId;
let listingId;

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
  vendor = await login(
    DEV_CREDENTIALS.vendor.email,
    DEV_CREDENTIALS.vendor.password,
  );

  const [[partnerRow]] = await pool.query(
    "SELECT id FROM partners WHERE slug = 'yerevan-boutique-hospitality'",
  );
  partnerId = partnerRow.id;
  const [[language]] = await pool.query(
    "SELECT id FROM languages WHERE code = 'en'",
  );

  const createRes = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingType: 'HOTEL',
      translations: [
        {
          languageId: language.id,
          title: `Moderation Test Hotel ${Date.now()}`,
          summary: 'A nice place to stay.',
          description: 'Full description of the listing.',
        },
      ],
    });
  listingId = createRes.body.data.id;

  // No dev account is seeded with MODERATOR — assign it directly to a
  // throwaway registered user, same pattern Stage 11.2's test uses.
  const registerRes = await request(app).post('/api/v1/auth/register').send({
    email: 'listing.moderator@example.com',
    password: 'ListingModerator!2024',
    firstName: 'Listing',
    lastName: 'Moderator',
  });
  await pool.query(
    `INSERT IGNORE INTO role_user (role_id, user_id)
     SELECT id, ? FROM roles WHERE code = 'MODERATOR'`,
    [registerRes.body.data.user.id],
  );
  moderator = await login(
    'listing.moderator@example.com',
    'ListingModerator!2024',
  );
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /listings/admin (admin queue)', () => {
  test('a SUPER_ADMIN receives a cursor-paginated list including a DRAFT listing', async () => {
    const res = await request(app)
      .get('/api/v1/listings/admin')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: listingId,
          partner_display_name: 'Yerevan Boutique Hospitality',
          moderation_status: 'PENDING',
        }),
      ]),
    );
    expect(res.body.meta).toEqual(
      expect.objectContaining({ has_more: expect.any(Boolean) }),
    );
  });

  test('a keyword filter narrows to the matching listing title', async () => {
    const res = await request(app)
      .get(`/api/v1/listings/admin?keyword=Moderation Test Hotel`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: listingId })]),
    );
  });

  test('a moderationStatus filter narrows correctly', async () => {
    const res = await request(app)
      .get('/api/v1/listings/admin?moderationStatus=REJECTED')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: listingId })]),
    );
  });

  test('MODERATOR can list the queue', async () => {
    const res = await request(app)
      .get('/api/v1/listings/admin')
      .set('Authorization', `Bearer ${moderator.accessToken}`);
    expect(res.status).toBe(200);
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .get('/api/v1/listings/admin')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /listings/admin/:id (admin detail)', () => {
  test('a SUPER_ADMIN sees the full listing shape even though it is unpublished (DRAFT)', async () => {
    const res = await request(app)
      .get(`/api/v1/listings/admin/${listingId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        id: listingId,
        status: 'DRAFT',
        moderation_status: 'PENDING',
      }),
    );
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/listings/admin/${listingId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /listings/admin/:id/moderation-status (approve/reject with notes)', () => {
  test('MODERATOR can reject with notes, then approve — writes an audit log entry each time', async () => {
    const rejectRes = await request(app)
      .patch(`/api/v1/listings/admin/${listingId}/moderation-status`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ status: 'REJECTED', notes: 'Missing required photos.' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.moderation_status).toBe('REJECTED');

    const approveRes = await request(app)
      .patch(`/api/v1/listings/admin/${listingId}/moderation-status`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ status: 'APPROVED' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.moderation_status).toBe('APPROVED');

    const [logs] = await pool.query(
      `SELECT action FROM audit_logs
       WHERE target_type = 'listing' AND target_id = ? AND action = 'listing.moderation_status_changed'
       ORDER BY id DESC LIMIT 2`,
      [listingId],
    );
    expect(logs.length).toBe(2);
  });

  test('a CUSTOMER is rejected with 403', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/admin/${listingId}/moderation-status`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ status: 'FLAGGED' });
    expect(res.status).toBe(403);
  });

  test('an invalid status is rejected with 422', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/admin/${listingId}/moderation-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'PUBLISHED' });
    expect(res.status).toBe(422);
  });
});

/**
 * P2.1 (Admin Listing Detail): `moderation_notes` was already fetched by
 * the repository but never exposed by any DTO — the admin detail page
 * this section verifies had no data source for it. Confirms it's now
 * present on the admin response, and deliberately absent from the
 * public one (a moderation/rejection note is internal admin content,
 * not something a public visitor should see).
 */
describe('GET /listings/admin/:id exposes moderation_notes (P2.1)', () => {
  test('a note set via reject is returned on the admin detail response, never on the public one', async () => {
    const rejectRes = await request(app)
      .patch(`/api/v1/listings/admin/${listingId}/moderation-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'REJECTED', notes: 'Please add exterior photos.' });
    expect(rejectRes.status).toBe(200);

    const adminDetailRes = await request(app)
      .get(`/api/v1/listings/admin/${listingId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminDetailRes.status).toBe(200);
    expect(adminDetailRes.body.data.moderation_notes).toBe(
      'Please add exterior photos.',
    );

    // The vendor owns this listing, so the public route's owner-fallback
    // visibility rule lets them see it despite it being DRAFT/REJECTED —
    // the point here is only that `moderation_notes` itself is absent
    // from this response shape, regardless of who can reach it.
    const publicRes = await request(app)
      .get(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.moderation_notes).toBeUndefined();
  });
});
