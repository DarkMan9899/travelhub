/**
 * Sprint 9 (final architecture): "Public availability lookup, calendar
 * queries." Exercises `GET /availability/:listingId` (public blackout-
 * range view, no `reason`/`id`) and `GET /availability/:listingId/calendar`
 * (merged `availability_calendar` + `blackout_dates` day-by-day view),
 * including the 404-masking a draft listing gets from reusing
 * `ListingService.getListing` (Sprint 7), and the "ambiguous unit"
 * rejection once a listing has more than one bookable unit — Availability
 * never guesses which one the caller means.
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
let partnerId;
let languageId;
let listingId;
let draftListingId;
let multiUnitListingId;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

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

async function registerUnit(targetListingId, bookableUnitType = 'HOTEL_ROOM') {
  const res = await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId: targetListingId, bookableUnitType });
  return res.body.data.id;
}

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

/**
 * The public-view tests below need an actually PUBLISHED listing — an
 * anonymous request against a DRAFT 404s via `ListingService.getListing`'s
 * masking (correct, and exactly what `draftListingId`'s own tests exist to
 * prove) before it ever reaches the calendar logic these tests target.
 * `draftListingId` is deliberately left unpublished; this is never called
 * for it.
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

  listingId = await createListing(
    `Availability Calendar Test ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  );
  await publishListing(listingId);
  const listingUnitId = await registerUnit(listingId, 'HOTEL_ROOM');

  // A calendar-level block (availability_calendar), independent of blackout.
  await request(app)
    .post('/api/v1/availability')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      unitId: listingUnitId,
      dateFrom: '2026-07-10',
      dateTo: '2026-07-10',
      status: 'BLOCKED',
    });

  // A blackout veto covering a different day.
  await request(app)
    .post('/api/v1/availability/blackouts')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      listingId,
      dateFrom: '2026-07-12',
      dateTo: '2026-07-12',
      reason: 'Owner personal use',
    });

  draftListingId = await createListing(
    `Draft Availability Test ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  );

  multiUnitListingId = await createListing(
    `Multi Unit Availability Test ${Date.now()}-${Math.floor(Math.random() * 100000)}`,
  );
  await publishListing(multiUnitListingId);
  await registerUnit(multiUnitListingId, 'HOTEL_ROOM');
  await registerUnit(multiUnitListingId, 'RESTAURANT_TABLE');
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /availability/:listingId — public blackout range view', () => {
  test('returns date_from/date_to but never reason or id', async () => {
    const res = await request(app).get(`/api/v1/availability/${listingId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toEqual({
      date_from: '2026-07-12',
      date_to: '2026-07-12',
    });
    expect(res.body.data[0]).not.toHaveProperty('reason');
    expect(res.body.data[0]).not.toHaveProperty('id');
  });

  test('a draft listing 404s for a stranger (existence not leaked)', async () => {
    const res = await request(app)
      .get(`/api/v1/availability/${draftListingId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(404);
  });

  test("the owner can view their own draft listing's ranges", async () => {
    const res = await request(app)
      .get(`/api/v1/availability/${draftListingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /availability/:listingId/calendar — merged day expansion', () => {
  test('reflects both the availability_calendar block and the blackout veto', async () => {
    const res = await request(app).get(
      `/api/v1/availability/${listingId}/calendar?from=2026-07-08&to=2026-07-14`,
    );
    expect(res.status).toBe(200);
    const byDate = Object.fromEntries(
      res.body.data.map((d) => [d.date, d.status]),
    );
    expect(byDate['2026-07-09']).toBe('AVAILABLE');
    expect(byDate['2026-07-10']).toBe('BLOCKED'); // availability_calendar row
    expect(byDate['2026-07-11']).toBe('AVAILABLE');
    expect(byDate['2026-07-12']).toBe('BLOCKED'); // blackout veto
    expect(byDate['2026-07-13']).toBe('AVAILABLE');
  });

  test("a draft listing's calendar 404s for a stranger", async () => {
    const res = await request(app).get(
      `/api/v1/availability/${draftListingId}/calendar?from=2026-08-01&to=2026-08-07`,
    );
    expect(res.status).toBe(404);
  });

  test('the owner can view a listing with no bookable unit yet — every day defaults to AVAILABLE', async () => {
    const res = await request(app)
      .get(
        `/api/v1/availability/${draftListingId}/calendar?from=2026-08-01&to=2026-08-03`,
      )
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((d) => d.status === 'AVAILABLE')).toBe(true);
  });

  test('rejects a span longer than 366 days with 422', async () => {
    const res = await request(app).get(
      `/api/v1/availability/${listingId}/calendar?from=2026-01-01&to=2028-01-01`,
    );
    expect(res.status).toBe(422);
  });

  test('rejects to before from with 422', async () => {
    const res = await request(app).get(
      `/api/v1/availability/${listingId}/calendar?from=2026-07-10&to=2026-07-01`,
    );
    expect(res.status).toBe(422);
  });

  test('a listing with more than one unit requires an explicit unitId — Availability never guesses', async () => {
    const ambiguousRes = await request(app).get(
      `/api/v1/availability/${multiUnitListingId}/calendar?from=2026-08-01&to=2026-08-03`,
    );
    expect(ambiguousRes.status).toBe(422);
    expect(ambiguousRes.body.error.details?.[0]?.issue).toBe('AMBIGUOUS_UNIT');

    const [[unitRow]] = await pool.query(
      'SELECT id FROM bookable_units WHERE listing_id = ? LIMIT 1',
      [multiUnitListingId],
    );
    const explicitRes = await request(app).get(
      `/api/v1/availability/${multiUnitListingId}/calendar?from=2026-08-01&to=2026-08-03&unitId=${unitRow.id}`,
    );
    expect(explicitRes.status).toBe(200);
  });
});
