/**
 * Sprint 10: `POST /bookings` converts already-granted holds into a real,
 * auditable booking. Exercises the happy path plus the schema-enforced
 * consistency rules (single listing, single unit type, single currency)
 * and the pricing-completeness/hold-ownership guards described in the
 * approved proposal §12.
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
  return { accessToken: res.body.data.access_token };
}

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

/**
 * `BookingService.createBooking` resolves the listing via `ListingService
 * .getListing(principal, ...)` with the CUSTOMER as principal — a DRAFT
 * listing 404s for any non-owner, so every listing created here is
 * published immediately; this file has no case that needs a draft.
 */
async function createListing(title) {
  const res = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingType: 'HOTEL',
      translations: [{ languageId, title }],
    });
  const listingId = res.body.data.id;

  await request(app)
    .patch(`/api/v1/listings/${listingId}`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ location: { latitude: 40.1772, longitude: 44.5035 } });
  await request(app)
    .post(`/api/v1/listings/${listingId}/media`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .set('Content-Type', 'image/png')
    .send(ONE_PX_PNG);
  await request(app)
    .post(`/api/v1/listings/${listingId}/publish`)
    .set('Authorization', `Bearer ${vendor.accessToken}`);

  return listingId;
}

async function registerUnit(
  listingId,
  bookableUnitType = 'HOTEL_ROOM',
  capacity = 1,
) {
  const res = await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId, bookableUnitType, capacity });
  return res.body.data.id;
}

async function setPrice(unitId, dateFrom, dateTo, amount, currency = 'AMD') {
  await request(app)
    .post('/api/v1/availability')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      unitId,
      dateFrom,
      dateTo,
      status: 'AVAILABLE',
      priceOverrideAmount: amount,
      priceOverrideCurrency: currency,
    });
}

async function createHold(
  customerAuth,
  unitId,
  dateFrom,
  dateTo,
  quantity = 1,
) {
  const res = await request(app)
    .post('/api/v1/booking-holds')
    .set('Authorization', `Bearer ${customerAuth.accessToken}`)
    .send({ items: [{ bookableUnitId: unitId, dateFrom, dateTo, quantity }] });
  return res.body.data.items[0].hold_ids;
}

const GUEST_CONTACT = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+37400000000',
};

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

describe('POST /bookings — converts holds into a booking', () => {
  test('creates a PENDING_VENDOR booking with the correct total', async () => {
    const listingId = await createListing(
      `Booking Creation Test ${Date.now()}`,
    );
    const unitId = await registerUnit(listingId);
    const dateFrom = '2027-02-01';
    const dateTo = '2027-02-02';
    await setPrice(unitId, dateFrom, dateTo, 10_000);
    const holdIds = await createHold(customer, unitId, dateFrom, dateTo, 1);

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [{ holdIds, guests: [{ fullName: 'Ada Lovelace' }] }],
        guestContactSnapshot: GUEST_CONTACT,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING_VENDOR');
    expect(res.body.data.listing_id).toBe(listingId);
    expect(res.body.data.booking_type).toBe('HOTEL_ROOM_BOOKING');
    expect(res.body.data.currency).toBe('AMD');
    // Two priced days (10_000 + 10_000) at quantity 1.
    expect(res.body.data.total_amount).toBe('20000.00');
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].guests).toHaveLength(1);
    expect(res.body.data.booking_reference).toMatch(/^BK-\d{8}-[A-Z2-9]{8}$/);
  });

  test('rejects a booking whose holds no longer exist (already consumed) with 409 HOLD_EXPIRED', async () => {
    const listingId = await createListing(
      `Booking Stale Hold Test ${Date.now()}`,
    );
    const unitId = await registerUnit(listingId);
    const dateFrom = '2027-02-10';
    const dateTo = '2027-02-11';
    await setPrice(unitId, dateFrom, dateTo, 5_000);
    const holdIds = await createHold(customer, unitId, dateFrom, dateTo, 1);

    const firstAttempt = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [{ holdIds, guests: [] }],
        guestContactSnapshot: GUEST_CONTACT,
      });
    expect(firstAttempt.status).toBe(201);

    const secondAttempt = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [{ holdIds, guests: [] }],
        guestContactSnapshot: GUEST_CONTACT,
      });
    expect(secondAttempt.status).toBe(409);
    expect(secondAttempt.body.error.code).toBe('HOLD_EXPIRED');
  });

  test('rejects a booking spanning two different listings with 422 MULTI_LISTING_BOOKING', async () => {
    const listingA = await createListing(
      `Booking MultiListing A ${Date.now()}`,
    );
    const listingB = await createListing(
      `Booking MultiListing B ${Date.now()}`,
    );
    const unitA = await registerUnit(listingA);
    const unitB = await registerUnit(listingB);
    const dateFrom = '2027-02-15';
    const dateTo = '2027-02-16';
    await setPrice(unitA, dateFrom, dateTo, 5_000);
    await setPrice(unitB, dateFrom, dateTo, 5_000);
    const holdIdsA = await createHold(customer, unitA, dateFrom, dateTo, 1);
    const holdIdsB = await createHold(customer, unitB, dateFrom, dateTo, 1);

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [
          { holdIds: holdIdsA, guests: [] },
          { holdIds: holdIdsB, guests: [] },
        ],
        guestContactSnapshot: GUEST_CONTACT,
      });

    expect(res.status).toBe(422);
    expect(
      res.body.error.details.some((d) => d.issue === 'MULTI_LISTING_BOOKING'),
    ).toBe(true);
  });

  test('rejects a booking when a requested date has no price set (422 PRICING_INCOMPLETE)', async () => {
    const listingId = await createListing(
      `Booking No Price Test ${Date.now()}`,
    );
    const unitId = await registerUnit(listingId);
    const dateFrom = '2027-03-01';
    const dateTo = '2027-03-02';
    // Deliberately never call setPrice for this range.
    const holdIds = await createHold(customer, unitId, dateFrom, dateTo, 1);

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        items: [{ holdIds, guests: [] }],
        guestContactSnapshot: GUEST_CONTACT,
      });

    expect(res.status).toBe(422);
    expect(
      res.body.error.details.some((d) => d.issue === 'PRICING_INCOMPLETE'),
    ).toBe(true);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .send({
        items: [{ holdIds: [1], guests: [] }],
        guestContactSnapshot: GUEST_CONTACT,
      });
    expect(res.status).toBe(401);
  });
});
