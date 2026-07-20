/**
 * Sprint 7: "Integrate listings with the existing storage abstraction.
 * Allow attaching media records to listings." Reuses the local
 * `StorageProvider` and `mediaConstraints.js` MIME/size checks, mirroring
 * `tests/integration/users/userProfile.test.js`'s avatar-upload test.
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
let languageId;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

async function createDraftListing() {
  const res = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingType: 'HOTEL',
      translations: [
        {
          languageId,
          title: `Media Test ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        },
      ],
    });
  return res.body.data.id;
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
  const [[language]] = await pool.query(
    "SELECT id FROM languages WHERE code = 'en'",
  );
  languageId = language.id;
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('POST /listings/:id/media — attach', () => {
  test('the owner can attach an image; the first image becomes the cover', async () => {
    const listingId = await createDraftListing();

    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);

    expect(res.status).toBe(201);
    expect(res.body.data.media_type).toBe('IMAGE');
    expect(res.body.data.is_cover).toBe(true);
    expect(res.body.data.moderation_status).toBe('PENDING');
  });

  test('a non-owner cannot attach media (403)', async () => {
    const listingId = await createDraftListing();

    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);

    expect(res.status).toBe(403);
  });

  test('rejects an unsupported content type', async () => {
    const listingId = await createDraftListing();

    const res = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .set('Content-Type', 'application/zip')
      .send(Buffer.from('not really a zip'));

    expect([415, 422]).toContain(res.status);
  });
});

describe('GET /listings/:id/media — list', () => {
  test('lists media attached to the listing, ordered by position', async () => {
    const listingId = await createDraftListing();
    await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);

    // The listing is a DRAFT (never published in this file) — an
    // anonymous request 404s via ListingService.getListing's masking, so
    // this owner-media-management check must authenticate as the owner.
    const res = await request(app)
      .get(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('PATCH /listings/:id/media/:mediaId — reorder / set cover', () => {
  test('the owner can update position and cover flag', async () => {
    const listingId = await createDraftListing();
    const attachRes = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    const mediaId = attachRes.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/media/${mediaId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ position: 3, isCover: false });

    expect(res.status).toBe(200);
    expect(res.body.data.position).toBe(3);
    expect(res.body.data.is_cover).toBe(false);
  });
});

describe('DELETE /listings/:id/media/:mediaId — remove', () => {
  test('the owner can remove media; it no longer appears in the list', async () => {
    const listingId = await createDraftListing();
    const attachRes = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    const mediaId = attachRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/listings/${listingId}/media/${mediaId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app)
      .get(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(listRes.body.data).toHaveLength(0);
  });
});
