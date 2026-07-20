/**
 * Sprint 9 (final architecture): "Owner availability management," built
 * on `bookable_units` + `availability_calendar` (the primary engine) with
 * `blackout_dates` as the complementary veto layer. Availability is
 * inventory-agnostic: `bookable_units` are only ever created via the
 * explicit `POST /availability/units` call (never as a side effect of a
 * calendar write), and `POST /availability` consumes an existing
 * `unitId` rather than creating one. Exercises unit CRUD, ownership, the
 * AVAILABLE/BLOCKED-only write guard, overlap detection, and
 * management-list visibility — against a real listing created via the
 * Listings API (Sprint 7), never duplicating its business logic.
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

let pool;
let vendor;
let customer;
let admin;
let partnerId;
let languageId;
let listingId;
let unitId;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function createListing(title) {
  const res = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingType: 'HOTEL',
      translations: [{ languageId, title }],
    });
  return res.body.data.id;
}

/**
 * Non-owner requests below must actually reach `ListingService
 * .getListing`'s owner-vs-permission branch (a genuine 403) rather than
 * its earlier "not published and not the owner" 404-masking branch — so
 * every listing these tests act on must be published first, the same
 * `location` + image + `/publish` sequence `listings/listingCrud.test.js`
 * already establishes as the minimum publish-readiness bar.
 */
async function publishListing(id) {
  await request(app)
    .patch(`/api/v1/listings/${id}`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ location: { latitude: 40.1772, longitude: 44.5035 } });
  await request(app)
    .post(`/api/v1/listings/${id}/media`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .set('Content-Type', 'image/png')
    .send(ONE_PX_PNG);
  await request(app)
    .post(`/api/v1/listings/${id}/publish`)
    .set('Authorization', `Bearer ${vendor.accessToken}`);
}

async function registerUnit(targetListingId, bookableUnitType = 'HOTEL_ROOM') {
  const res = await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId: targetListingId, bookableUnitType });
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
  admin = await login(
    DEV_CREDENTIALS.admin.email,
    DEV_CREDENTIALS.admin.password,
  );

  const [[partnerRow]] = await pool.query(
    "SELECT id FROM partners WHERE slug = 'yerevan-boutique-hospitality'",
  );
  partnerId = partnerRow.id;
  const [[language]] = await pool.query(
    "SELECT id FROM languages WHERE code = 'en'",
  );
  languageId = language.id;

  listingId = await createListing(
    `Availability CRUD Test Listing ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  );
  await publishListing(listingId);
  unitId = await registerUnit(listingId);
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('POST /availability/units — inventory-agnostic unit registration', () => {
  test('the owner can register a bookable unit for their listing', async () => {
    const res = await request(app)
      .post('/api/v1/availability/units')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ listingId, bookableUnitType: 'RESTAURANT_TABLE', capacity: 4 });

    expect(res.status).toBe(201);
    expect(res.body.data.bookable_unit_type).toBe('RESTAURANT_TABLE');
    expect(res.body.data.capacity).toBe(4);
    expect(res.body.data.listing_id).toBe(listingId);
  });

  test('registering the same (listing, type) twice returns the same unit (idempotent find-or-create)', async () => {
    const firstId = await registerUnit(listingId, 'VEHICLE');
    const secondId = await registerUnit(listingId, 'VEHICLE');
    expect(secondId).toBe(firstId);
  });

  test('rejects an unknown bookableUnitType with 422', async () => {
    const res = await request(app)
      .post('/api/v1/availability/units')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ listingId, bookableUnitType: 'SPACESHIP_BERTH' });
    expect(res.status).toBe(422);
  });

  test('rejects a nonexistent listingId with 404', async () => {
    const res = await request(app)
      .post('/api/v1/availability/units')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ listingId: 9_999_999, bookableUnitType: 'HOTEL_ROOM' });
    expect(res.status).toBe(404);
  });

  test('a non-owner without listing.update is rejected with 403', async () => {
    const res = await request(app)
      .post('/api/v1/availability/units')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ listingId, bookableUnitType: 'HOTEL_ROOM' });
    expect(res.status).toBe(403);
  });

  test('an admin can register via the listing.moderate permission fallback', async () => {
    const res = await request(app)
      .post('/api/v1/availability/units')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ listingId, bookableUnitType: 'TOUR_DEPARTURE' });
    expect(res.status).toBe(201);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/availability/units')
      .send({ listingId, bookableUnitType: 'HOTEL_ROOM' });
    expect(res.status).toBe(401);
  });
});

describe('GET /availability/units — management list', () => {
  test("the owner sees their listing's units", async () => {
    const res = await request(app)
      .get(`/api/v1/availability/units?listingId=${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('a non-owner cannot list them (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/availability/units?listingId=${listingId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /availability/units/:id — retire a unit', () => {
  test('the owner can retire their own unit', async () => {
    const idToRetire = await registerUnit(listingId, 'RESTAURANT_TABLE');
    const res = await request(app)
      .delete(`/api/v1/availability/units/${idToRetire}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
  });

  test('a non-owner cannot retire it (403)', async () => {
    const idToRetire = await registerUnit(listingId, 'VEHICLE');
    const res = await request(app)
      .delete(`/api/v1/availability/units/${idToRetire}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('a nonexistent unit id 404s', async () => {
    const res = await request(app)
      .delete('/api/v1/availability/units/9999999')
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /availability — set calendar range (consumes an existing unitId)', () => {
  test('the owner can block a date range against a registered unit', async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        unitId,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-03',
        status: 'BLOCKED',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.every((entry) => entry.status === 'BLOCKED')).toBe(
      true,
    );
    expect(res.body.data.map((entry) => entry.date)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
  });

  test('defaults to AVAILABLE when status is omitted', async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ unitId, dateFrom: '2026-10-01', dateTo: '2026-10-01' });

    expect(res.status).toBe(201);
    expect(res.body.data[0].status).toBe('AVAILABLE');
  });

  test('rejects an attempt to write BOOKED — reserved for the Booking Engine', async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        unitId,
        dateFrom: '2026-12-05',
        dateTo: '2026-12-05',
        status: 'BOOKED',
      });
    expect(res.status).toBe(422);
  });

  test('rejects an inverted range with 422', async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ unitId, dateFrom: '2026-12-10', dateTo: '2026-12-01' });
    expect(res.status).toBe(422);
  });

  test('rejects a nonexistent unitId with 404 — Availability never creates one to compensate', async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        unitId: 9_999_999,
        dateFrom: '2026-12-15',
        dateTo: '2026-12-15',
      });
    expect(res.status).toBe(404);
  });

  test('a non-owner without listing.update is rejected with 403', async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ unitId, dateFrom: '2026-12-20', dateTo: '2026-12-20' });
    expect(res.status).toBe(403);
  });

  test('an admin can write via the listing.moderate permission fallback', async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ unitId, dateFrom: '2027-01-01', dateTo: '2027-01-01' });
    expect(res.status).toBe(201);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .send({ unitId, dateFrom: '2027-02-01', dateTo: '2027-02-01' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH/DELETE /availability/:id — single calendar entry', () => {
  let entryId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/availability')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ unitId, dateFrom: '2026-04-01', dateTo: '2026-04-01' });
    entryId = res.body.data[0].id;
  });

  test('the owner can update the status and quantity_available', async () => {
    const res = await request(app)
      .patch(`/api/v1/availability/${entryId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ status: 'BLOCKED', quantityAvailable: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('BLOCKED');
    expect(res.body.data.quantity_available).toBe(0);
  });

  test('rejects writing HELD with 422', async () => {
    const res = await request(app)
      .patch(`/api/v1/availability/${entryId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ status: 'HELD' });
    expect(res.status).toBe(422);
  });

  test('a non-owner cannot update (403)', async () => {
    const res = await request(app)
      .patch(`/api/v1/availability/${entryId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ status: 'AVAILABLE' });
    expect(res.status).toBe(403);
  });

  test('a nonexistent entry id 404s', async () => {
    const res = await request(app)
      .patch('/api/v1/availability/9999999')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ status: 'AVAILABLE' });
    expect(res.status).toBe(404);
  });

  test('the owner can delete an entry; a management-list query no longer includes it', async () => {
    const deleteRes = await request(app)
      .delete(`/api/v1/availability/${entryId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app)
      .get(
        `/api/v1/availability?listingId=${listingId}&from=2026-04-01&to=2026-04-01`,
      )
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(listRes.body.data.map((e) => e.id)).not.toContain(entryId);
  });
});

describe('GET /availability — calendar management list', () => {
  test('the owner sees their own listing entries', async () => {
    const res = await request(app)
      .get(`/api/v1/availability?listingId=${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('bookable_unit_id');
  });

  test('requires authentication', async () => {
    const res = await request(app).get(
      `/api/v1/availability?listingId=${listingId}`,
    );
    expect(res.status).toBe(401);
  });

  test('a customer browsing with no filters and no permission is rejected with 403', async () => {
    const res = await request(app)
      .get('/api/v1/availability')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('an admin can browse platform-wide with no filters', async () => {
    const res = await request(app)
      .get('/api/v1/availability')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST/PATCH/DELETE /availability/blackouts — complementary veto layer', () => {
  test('the owner can create a blackout range', async () => {
    const res = await request(app)
      .post('/api/v1/availability/blackouts')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        listingId,
        dateFrom: '2026-05-01',
        dateTo: '2026-05-03',
        reason: 'Maintenance',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.reason).toBe('Maintenance');
  });

  test('rejects an overlapping blackout range with 409', async () => {
    const res = await request(app)
      .post('/api/v1/availability/blackouts')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ listingId, dateFrom: '2026-05-02', dateTo: '2026-05-10' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OVERLAPPING_RANGE');
  });

  test('a non-owner cannot create a blackout (403)', async () => {
    const res = await request(app)
      .post('/api/v1/availability/blackouts')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ listingId, dateFrom: '2026-06-01', dateTo: '2026-06-02' });
    expect(res.status).toBe(403);
  });

  test('the owner can update and then delete a blackout range', async () => {
    const createRes = await request(app)
      .post('/api/v1/availability/blackouts')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ listingId, dateFrom: '2026-06-10', dateTo: '2026-06-12' });
    const blockId = createRes.body.data.id;

    const updateRes = await request(app)
      .patch(`/api/v1/availability/blackouts/${blockId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ reason: 'Updated' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.reason).toBe('Updated');

    const deleteRes = await request(app)
      .delete(`/api/v1/availability/blackouts/${blockId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(deleteRes.status).toBe(200);
  });

  test('GET /availability/blackouts requires authentication', async () => {
    const res = await request(app).get('/api/v1/availability/blackouts');
    expect(res.status).toBe(401);
  });

  test("GET /availability/blackouts lists the owner's ranges with reason and id", async () => {
    const res = await request(app)
      .get(`/api/v1/availability/blackouts?listingId=${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('reason');
    expect(res.body.data[0]).toHaveProperty('id');
  });
});
