/**
 * Sprint 7: "Create/Update/Delete listing, Publish/Unpublish, Draft
 * support, Listing status management, Slug uniqueness." Exercises the
 * full lifecycle against the real seeded partner
 * (`vendor@travelhub.dev` owns the verified `yerevan-boutique-hospitality`
 * partner, seeds/005_dev_accounts.js) plus a second, unverified partner
 * inserted directly for the `PARTNER_NOT_VERIFIED` case.
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

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

let pool;
let vendor;
let customer;
let partnerId;
let unverifiedPartnerId;
let languageId;
let categoryId;
let amenityId;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

function buildPayload(overrides = {}) {
  return {
    partnerId,
    listingType: 'HOTEL',
    translations: [
      {
        languageId,
        title: `Test Hotel ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        summary: 'A nice place to stay.',
        description: 'Full description of the listing.',
      },
    ],
    categoryIds: [categoryId],
    amenityIds: [amenityId],
    ...overrides,
  };
}

async function createDraftListing(overrides = {}) {
  const res = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send(buildPayload(overrides));
  return res;
}

async function makePublishable(listingId) {
  await request(app)
    .patch(`/api/v1/listings/${listingId}`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ location: { latitude: 40.1772, longitude: 44.5035 } });
  await request(app)
    .post(`/api/v1/listings/${listingId}/media`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .set('Content-Type', 'image/png')
    .send(ONE_PX_PNG);
}

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();
  pool = getMysqlPool();

  vendor = await login(
    DEV_CREDENTIALS.vendor.email,
    DEV_CREDENTIALS.vendor.password,
  );
  customer = await login(
    DEV_CREDENTIALS.customer.email,
    DEV_CREDENTIALS.customer.password,
  );

  const [[partnerRow]] = await pool.query(
    "SELECT id FROM partners WHERE slug = 'yerevan-boutique-hospitality'",
  );
  partnerId = partnerRow.id;

  const [[pendingStatus]] = await pool.query(
    "SELECT id FROM moderation_statuses WHERE code = 'PENDING'",
  );
  const [[approvedStatus]] = await pool.query(
    "SELECT id FROM moderation_statuses WHERE code = 'APPROVED'",
  );
  const [[ownerRole]] = await pool.query(
    "SELECT id FROM partner_employee_roles WHERE code = 'OWNER'",
  );
  const [unverifiedPartnerResult] = await pool.query(
    `INSERT INTO partners
      (legal_name, display_name, slug, verification_status_id, moderation_status_id, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'Unverified Partner LLC',
      'Unverified Partner',
      `unverified-partner-${Date.now()}`,
      pendingStatus.id,
      approvedStatus.id,
      vendor.userId,
    ],
  );
  unverifiedPartnerId = unverifiedPartnerResult.insertId;
  await pool.query(
    'INSERT INTO partner_employees (partner_id, user_id, role_id) VALUES (?, ?, ?)',
    [unverifiedPartnerId, vendor.userId, ownerRole.id],
  );

  const [[language]] = await pool.query(
    "SELECT id FROM languages WHERE code = 'en'",
  );
  languageId = language.id;
  const [[category]] = await pool.query(
    "SELECT id FROM listing_categories WHERE slug = 'hotels'",
  );
  categoryId = category.id;
  const [[amenity]] = await pool.query(
    "SELECT id FROM listing_amenities WHERE name = 'WiFi'",
  );
  amenityId = amenity.id;
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('POST /listings — create', () => {
  test('creates a listing that always starts in DRAFT', async () => {
    const res = await createDraftListing();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.partner_id).toBe(partnerId);
    expect(res.body.data.slug).toEqual(expect.any(String));
  });

  test('rejects a duplicate slug with 409 SLUG_ALREADY_EXISTS', async () => {
    const slug = `fixed-slug-${Date.now()}`;
    const first = await createDraftListing({ slug });
    expect(first.status).toBe(201);

    const second = await createDraftListing({ slug });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('SLUG_ALREADY_EXISTS');
  });

  test('rejects creation for an unverified partner with 403 PARTNER_NOT_VERIFIED', async () => {
    const res = await createDraftListing({ partnerId: unverifiedPartnerId });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PARTNER_NOT_VERIFIED');
  });

  test('rejects an unknown listing type with 422', async () => {
    const res = await createDraftListing({ listingType: 'SPACESHIP' });
    expect(res.status).toBe(422);
    expect(
      res.body.error.details.some((d) => d.issue === 'UNKNOWN_LISTING_TYPE'),
    ).toBe(true);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .send(buildPayload());
    expect(res.status).toBe(401);
  });
});

describe('GET /listings/:id — visibility', () => {
  test("a stranger gets 404 on someone else's draft (existence not leaked)", async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;

    const res = await request(app)
      .get(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(404);
  });

  test('the owner can see their own draft', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;

    const res = await request(app)
      .get(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DRAFT');
  });

  test('an unauthenticated request gets 404 on a draft', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;

    const res = await request(app).get(`/api/v1/listings/${listingId}`);
    expect(res.status).toBe(404);
  });

  test('a published listing is publicly visible', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;
    await makePublishable(listingId);
    await request(app)
      .post(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    const res = await request(app).get(`/api/v1/listings/${listingId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PUBLISHED');
  });
});

describe('PATCH /listings/:id — update, slug history', () => {
  test('changing the slug records the old slug in listing_slug_history', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;
    const oldSlug = created.body.data.slug;
    const newSlug = `renamed-${Date.now()}`;

    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ slug: newSlug });

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(newSlug);

    const [historyRows] = await pool.query(
      'SELECT old_slug FROM listing_slug_history WHERE listing_id = ?',
      [listingId],
    );
    expect(historyRows.map((row) => row.old_slug)).toContain(oldSlug);
  });

  test('rejects an empty update body with 422', async () => {
    const created = await createDraftListing();
    const res = await request(app)
      .patch(`/api/v1/listings/${created.body.data.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({});
    expect(res.status).toBe(422);
  });
});

describe('DELETE /listings/:id — soft delete', () => {
  test('soft-deletes the listing; it 404s afterward', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(getRes.status).toBe(404);
  });
});

describe('POST /listings/:id/publish — readiness gating', () => {
  test('rejects publishing an incomplete listing with 422 and field-level details', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;

    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    expect(res.status).toBe(422);
    const issues = res.body.error.details.map((d) => d.issue);
    expect(issues).toContain('AT_LEAST_ONE_IMAGE_REQUIRED');
    expect(issues).toContain('COMPLETE_LOCATION_REQUIRED');
  });

  test('publishes once translation, image, and location are all present', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;
    await makePublishable(listingId);

    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.published_at).toEqual(expect.any(String));
  });
});

describe('POST /listings/:id/unpublish', () => {
  test('unpublishes a published listing', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;
    await makePublishable(listingId);
    await request(app)
      .post(`/api/v1/listings/${listingId}/publish`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/unpublish`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('UNPUBLISHED');
  });

  test('cannot unpublish a listing that was never published (409)', async () => {
    const created = await createDraftListing();
    const listingId = created.body.data.id;

    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/unpublish`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });
});
