/**
 * Sprint 10: `POST /booking-holds` grants one `reservation_holds` row per
 * unit of requested quantity and decrements `availability_calendar.
 * quantity_available` under lock — this suite exercises the capacity
 * check, the blackout veto, concurrent-request safety, and release.
 * Built on a real listing + bookable unit created via the Listings
 * (Sprint 7) and Availability (Sprint 9) APIs, never duplicating their
 * business logic.
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

async function registerUnit(listingId, capacity = 1) {
  const res = await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId, bookableUnitType: 'HOTEL_ROOM', capacity });
  return res.body.data.id;
}

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();

  vendor = await login(
    DEV_CREDENTIALS.vendor.email,
    DEV_CREDENTIALS.vendor.password,
  );
  customer = await login(
    DEV_CREDENTIALS.customer.email,
    DEV_CREDENTIALS.customer.password,
  );

  const pool = getMysqlPool();
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

describe('POST /booking-holds — grants capacity under lock', () => {
  test('a customer can hold an available unit for a date range', async () => {
    const listingId = await createListing(`Hold Test ${Date.now()}`);
    const unitId = await registerUnit(listingId, 2);

    const res = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [
          {
            bookableUnitId: unitId,
            dateFrom: '2026-09-10',
            dateTo: '2026-09-12',
            quantity: 1,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].hold_ids).toHaveLength(1);
    expect(res.body.data.items[0].bookable_unit_id).toBe(unitId);
    expect(res.body.data.expires_at).toBeTruthy();
  });

  test('requesting more than the remaining capacity is rejected with 409 AVAILABILITY_CONFLICT', async () => {
    const listingId = await createListing(`Hold Capacity Test ${Date.now()}`);
    const unitId = await registerUnit(listingId, 1);

    const res = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [
          {
            bookableUnitId: unitId,
            dateFrom: '2026-09-20',
            dateTo: '2026-09-21',
            quantity: 2,
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AVAILABILITY_CONFLICT');
  });

  test('a second hold against already-fully-held capacity is rejected', async () => {
    const listingId = await createListing(`Hold Sequential Test ${Date.now()}`);
    const unitId = await registerUnit(listingId, 1);
    const dateFrom = '2026-10-01';
    const dateTo = '2026-10-02';

    const first = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [{ bookableUnitId: unitId, dateFrom, dateTo, quantity: 1 }],
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        items: [{ bookableUnitId: unitId, dateFrom, dateTo, quantity: 1 }],
      });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('AVAILABILITY_CONFLICT');
  });

  test('exactly `capacity` concurrent requests succeed against a limited-capacity unit', async () => {
    const listingId = await createListing(
      `Hold Concurrency Test ${Date.now()}`,
    );
    const unitId = await registerUnit(listingId, 3);
    const dateFrom = '2026-10-15';
    const dateTo = '2026-10-16';

    const attempts = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/v1/booking-holds')
        .set('Authorization', `Bearer ${customer.accessToken}`)
        .send({
          items: [{ bookableUnitId: unitId, dateFrom, dateTo, quantity: 1 }],
        }),
    );
    const results = await Promise.all(attempts);
    const succeeded = results.filter((res) => res.status === 201);
    const conflicted = results.filter((res) => res.status === 409);

    expect(succeeded).toHaveLength(3);
    expect(conflicted).toHaveLength(2);
    conflicted.forEach((res) =>
      expect(res.body.error.code).toBe('AVAILABILITY_CONFLICT'),
    );
  });

  test('a date range overlapping a blackout is rejected with 409 BLACKOUT_DATE', async () => {
    const listingId = await createListing(`Hold Blackout Test ${Date.now()}`);
    const unitId = await registerUnit(listingId, 1);

    await request(app)
      .post('/api/v1/availability/blackouts')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ listingId, dateFrom: '2026-11-01', dateTo: '2026-11-05' });

    const res = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [
          {
            bookableUnitId: unitId,
            dateFrom: '2026-11-02',
            dateTo: '2026-11-03',
            quantity: 1,
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BLACKOUT_DATE');
  });

  test('a nonexistent bookableUnitId 404s', async () => {
    const res = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [
          {
            bookableUnitId: 9_999_999,
            dateFrom: '2026-11-10',
            dateTo: '2026-11-11',
            quantity: 1,
          },
        ],
      });
    expect(res.status).toBe(404);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/booking-holds')
      .send({
        items: [
          {
            bookableUnitId: 1,
            dateFrom: '2026-11-10',
            dateTo: '2026-11-11',
            quantity: 1,
          },
        ],
      });
    expect(res.status).toBe(401);
  });
});

describe('GET /booking-holds — self-service listing', () => {
  test("lists the caller's own active holds", async () => {
    const listingId = await createListing(`Hold List Test ${Date.now()}`);
    const unitId = await registerUnit(listingId, 1);
    await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [
          {
            bookableUnitId: unitId,
            dateFrom: '2026-12-01',
            dateTo: '2026-12-02',
            quantity: 1,
          },
        ],
      });

    const res = await request(app)
      .get('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((hold) => hold.bookable_unit_id === unitId)).toBe(
      true,
    );
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/v1/booking-holds');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /booking-holds — release restores capacity', () => {
  test('releasing a hold lets a subsequent hold reach full capacity again', async () => {
    const listingId = await createListing(`Hold Release Test ${Date.now()}`);
    const unitId = await registerUnit(listingId, 1);
    const dateFrom = '2026-12-10';
    const dateTo = '2026-12-11';

    const createRes = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [{ bookableUnitId: unitId, dateFrom, dateTo, quantity: 1 }],
      });
    const holdIds = createRes.body.data.items[0].hold_ids;

    const blockedRes = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        items: [{ bookableUnitId: unitId, dateFrom, dateTo, quantity: 1 }],
      });
    expect(blockedRes.status).toBe(409);

    const releaseRes = await request(app)
      .delete('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ holdIds });
    expect(releaseRes.status).toBe(200);

    const retryRes = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        items: [{ bookableUnitId: unitId, dateFrom, dateTo, quantity: 1 }],
      });
    expect(retryRes.status).toBe(201);
  });

  test("releasing holds that are not the caller's own is rejected with 409 HOLD_EXPIRED", async () => {
    const listingId = await createListing(
      `Hold Release Ownership Test ${Date.now()}`,
    );
    const unitId = await registerUnit(listingId, 1);

    const createRes = await request(app)
      .post('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [
          {
            bookableUnitId: unitId,
            dateFrom: '2026-12-20',
            dateTo: '2026-12-21',
            quantity: 1,
          },
        ],
      });
    const holdIds = createRes.body.data.items[0].hold_ids;

    const res = await request(app)
      .delete('/api/v1/booking-holds')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ holdIds });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HOLD_EXPIRED');
  });
});
