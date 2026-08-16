/**
 * Phase 17 §Search Availability Integration — proves `GET /search` filters
 * on the REAL Inventory Engine (bookable_units + availability_calendar +
 * blackout_dates), not just listing metadata. Mirrors `searchListings.test.js`'s
 * fixture-via-API style (never hand-crafts rows Listings/Availability's own
 * services own).
 *
 * Explicitly covers a non-accommodation category (TOUR_DEPARTURE, single-day
 * request) alongside the dominant Hotel "stay" case, since the search filter
 * must never be hotel-only per the Phase 17 brief.
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
let partnerId;
let languageId;
let hotelsCategoryId;
let toursCategoryId;
let yerevanCityId;

let listingRoomy; // HOTEL_ROOM, capacity 3, no blocks — available
let listingSoldOut; // HOTEL_ROOM, capacity 1, fully blocked for the search range
let listingBlackout; // HOTEL_ROOM, capacity 3, listing-level blackout over the search range
let listingTour; // TOUR_DEPARTURE, capacity 2 — single-day, non-accommodation
let blackoutId;
let soldOutUnitId;

const STAY_FROM = '2026-09-10';
const STAY_TO = '2026-09-12'; // checkout-exclusive: consumed nights are 09-10, 09-11
const TOUR_DAY = '2026-09-15';

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

async function createListing({ title, listingType, categoryId, cityId }) {
  const res = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingType,
      translations: [
        { languageId, title, description: `${title} — integration fixture.` },
      ],
      categoryIds: [categoryId],
      location: { cityId },
    });
  return res.body.data.id;
}

async function publishListing(listingId, { bookableUnitType, capacity }) {
  await request(app)
    .patch(`/api/v1/listings/${listingId}`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      location: { latitude: 40.18, longitude: 44.5 },
      policyValues: [
        { code: 'cancellation_policy', value: 'FLEXIBLE' },
        { code: 'check_in_time', value: '14:00' },
        { code: 'check_out_time', value: '11:00' },
      ],
    });
  await request(app)
    .post(`/api/v1/listings/${listingId}/media`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .set('Content-Type', 'image/png')
    .send(ONE_PX_PNG);
  const unitRes = await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId, bookableUnitType, capacity });
  await request(app)
    .post(`/api/v1/listings/${listingId}/publish`)
    .set('Authorization', `Bearer ${vendor.accessToken}`);
  return unitRes.body.data.id;
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

  const [[partnerRow]] = await pool.query(
    "SELECT id FROM partners WHERE slug = 'yerevan-boutique-hospitality'",
  );
  partnerId = partnerRow.id;
  const [[language]] = await pool.query(
    "SELECT id FROM languages WHERE code = 'en'",
  );
  languageId = language.id;
  const [[hotelsCategory]] = await pool.query(
    "SELECT id FROM listing_categories WHERE slug = 'hotels'",
  );
  hotelsCategoryId = hotelsCategory.id;
  const [[toursCategory]] = await pool.query(
    "SELECT id FROM listing_categories WHERE slug = 'tours'",
  );
  toursCategoryId = toursCategory.id;
  const [[yerevan]] = await pool.query(
    "SELECT id FROM cities WHERE slug = 'yerevan'",
  );
  yerevanCityId = yerevan.id;

  listingRoomy = await createListing({
    title: 'Availability Roomy Hotel',
    listingType: 'HOTEL',
    categoryId: hotelsCategoryId,
    cityId: yerevanCityId,
  });
  listingSoldOut = await createListing({
    title: 'Availability Sold Out Hotel',
    listingType: 'HOTEL',
    categoryId: hotelsCategoryId,
    cityId: yerevanCityId,
  });
  listingBlackout = await createListing({
    title: 'Availability Blackout Hotel',
    listingType: 'HOTEL',
    categoryId: hotelsCategoryId,
    cityId: yerevanCityId,
  });
  listingTour = await createListing({
    title: 'Availability Mountain Day Tour',
    listingType: 'TOUR',
    categoryId: toursCategoryId,
    cityId: yerevanCityId,
  });

  await publishListing(listingRoomy, {
    bookableUnitType: 'HOTEL_ROOM',
    capacity: 3,
  });
  soldOutUnitId = await publishListing(listingSoldOut, {
    bookableUnitType: 'HOTEL_ROOM',
    capacity: 1,
  });
  await publishListing(listingBlackout, {
    bookableUnitType: 'HOTEL_ROOM',
    capacity: 3,
  });
  await publishListing(listingTour, {
    bookableUnitType: 'TOUR_DEPARTURE',
    capacity: 2,
  });

  // Fully consume the sold-out hotel's only unit for the search's stay
  // range via a manual block — the same real write path a Partner uses.
  await request(app)
    .post('/api/v1/availability/blocks')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      unitId: soldOutUnitId,
      dateFrom: STAY_FROM,
      dateTo: STAY_TO,
      quantity: 1,
      reasonCode: 'MAINTENANCE',
    });

  // Listing-level blackout veto over the same stay range.
  const blackoutRes = await request(app)
    .post('/api/v1/availability/blackouts')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId: listingBlackout, dateFrom: STAY_FROM, dateTo: STAY_TO });
  blackoutId = blackoutRes.body.data.id;
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /search — availability filtering (Inventory Engine)', () => {
  test('a listing with sufficient capacity for the whole stay is included', async () => {
    const res = await request(app).get(
      `/api/v1/search?keyword=Availability&dateFrom=${STAY_FROM}&dateTo=${STAY_TO}&guests=1`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toContain(listingRoomy);
  });

  test('a listing whose only unit is fully blocked for the stay is excluded', async () => {
    const res = await request(app).get(
      `/api/v1/search?keyword=Availability&dateFrom=${STAY_FROM}&dateTo=${STAY_TO}&guests=1`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).not.toContain(listingSoldOut);
  });

  test('a listing under a listing-level blackout covering the stay is excluded', async () => {
    const res = await request(app).get(
      `/api/v1/search?keyword=Availability&dateFrom=${STAY_FROM}&dateTo=${STAY_TO}&guests=1`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).not.toContain(listingBlackout);
  });

  test('releasing the blackout makes the listing reappear in the same search', async () => {
    await request(app)
      .delete(`/api/v1/availability/blackouts/${blackoutId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);

    const res = await request(app).get(
      `/api/v1/search?keyword=Availability&dateFrom=${STAY_FROM}&dateTo=${STAY_TO}&guests=1`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toContain(listingBlackout);
  });

  test('a non-accommodation single-day search (TOUR_DEPARTURE) is respected, proving no hotel-only logic', async () => {
    const withinCapacity = await request(app).get(
      `/api/v1/search?keyword=Availability&dateFrom=${TOUR_DAY}&dateTo=${TOUR_DAY}&guests=2`,
    );
    expect(withinCapacity.status).toBe(200);
    expect(withinCapacity.body.data.map((r) => r.id)).toContain(listingTour);

    const overCapacity = await request(app).get(
      `/api/v1/search?keyword=Availability&dateFrom=${TOUR_DAY}&dateTo=${TOUR_DAY}&guests=3`,
    );
    expect(overCapacity.status).toBe(200);
    expect(overCapacity.body.data.map((r) => r.id)).not.toContain(listingTour);
  });

  test('without dateFrom/dateTo, availability is not filtered at all (every fixture listing appears)', async () => {
    const res = await request(app).get('/api/v1/search?keyword=Availability');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        listingRoomy,
        listingSoldOut,
        listingBlackout,
        listingTour,
      ]),
    );
  });

  test('dateFrom without dateTo is rejected with 422', async () => {
    const res = await request(app).get(`/api/v1/search?dateFrom=${STAY_FROM}`);
    expect(res.status).toBe(422);
  });

  test('dateTo before dateFrom is rejected with 422', async () => {
    const res = await request(app).get(
      `/api/v1/search?dateFrom=${STAY_TO}&dateTo=${STAY_FROM}`,
    );
    expect(res.status).toBe(422);
  });
});
