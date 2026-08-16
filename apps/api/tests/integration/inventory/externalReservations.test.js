/**
 * Phase 17 external reservations — single create + CSV wizard's bulk
 * import endpoint (spec §10, §21). `POST /availability/external-
 * reservations/bulk-import` backs the frontend `CsvImportWizard`
 * (`useBulkImportExternalReservationsMutation`) — previously untested
 * despite being live, unattended-write logic (per-row transactional
 * apply, duplicate-`externalReference` detection, capacity-conflict
 * per-row failure without aborting the whole batch).
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

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { accessToken: res.body.data.access_token };
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

async function registerUnit(listingId, capacity = 3) {
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

describe('External reservations — single create + bulk import (CSV wizard)', () => {
  test('creates a single external reservation and consumes capacity', async () => {
    const listingId = await createListing(`Single External ${Date.now()}`);
    const unitId = await registerUnit(listingId, 2);

    const res = await request(app)
      .post('/api/v1/availability/external-reservations')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        unitId,
        dateFrom: '2027-02-10',
        dateTo: '2027-02-11',
        sourceCode: 'PHONE',
        guestName: 'Ana Smith',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.source_code).toBe('PHONE');

    const breakdownRes = await request(app)
      .get(`/api/v1/availability/units/${unitId}/breakdown`)
      .query({ from: '2027-02-10', to: '2027-02-10' })
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(breakdownRes.body.data[0].external).toBe(1);
    expect(breakdownRes.body.data[0].available).toBe(1);
  });

  test("a customer (no partner relationship) cannot create an external reservation on another partner's unpublished listing", async () => {
    // `#loadUnitForCapability` resolves the owning listing via
    // `listingService.getListing` before the RBAC capability check ever
    // runs — a fresh (DRAFT) listing 404s for a non-owner principal
    // rather than leaking the unit's existence via a 403, matching this
    // codebase's established "don't confirm existence to unauthorized
    // callers" posture for unpublished resources.
    const listingId = await createListing(`Single External RBAC ${Date.now()}`);
    const unitId = await registerUnit(listingId, 2);

    const res = await request(app)
      .post('/api/v1/availability/external-reservations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        unitId,
        dateFrom: '2027-02-10',
        dateTo: '2027-02-11',
        sourceCode: 'PHONE',
      });
    expect(res.status).toBe(404);
  });

  test('bulk-import creates every valid row and reports per-row status', async () => {
    const listingId = await createListing(`Bulk Import ${Date.now()}`);
    const unitId = await registerUnit(listingId, 5);

    const res = await request(app)
      .post('/api/v1/availability/external-reservations/bulk-import')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        unitId,
        sourceCode: 'AIRBNB',
        rows: [
          { dateFrom: '2027-03-01', dateTo: '2027-03-02', guestName: 'Row A' },
          { dateFrom: '2027-03-05', dateTo: '2027-03-06', guestName: 'Row B' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.results.every((r) => r.status === 'CREATED')).toBe(
      true,
    );
  });

  test('bulk-import skips a row whose externalReference already exists for an overlapping date', async () => {
    const listingId = await createListing(`Bulk Import Dup ${Date.now()}`);
    const unitId = await registerUnit(listingId, 5);
    const reference = `ext-ref-${Date.now()}`;

    const first = await request(app)
      .post('/api/v1/availability/external-reservations/bulk-import')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        unitId,
        sourceCode: 'BOOKING_COM',
        rows: [
          {
            dateFrom: '2027-04-01',
            dateTo: '2027-04-02',
            externalReference: reference,
          },
        ],
      });
    expect(first.body.data.results[0].status).toBe('CREATED');

    const second = await request(app)
      .post('/api/v1/availability/external-reservations/bulk-import')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        unitId,
        sourceCode: 'BOOKING_COM',
        rows: [
          {
            dateFrom: '2027-04-01',
            dateTo: '2027-04-02',
            externalReference: reference,
          },
        ],
      });
    expect(second.body.data.results[0].status).toBe('SKIPPED_DUPLICATE');
  });

  test('bulk-import fails a row that exceeds remaining capacity without aborting the rest of the batch', async () => {
    const listingId = await createListing(`Bulk Import Conflict ${Date.now()}`);
    const unitId = await registerUnit(listingId, 1);

    const res = await request(app)
      .post('/api/v1/availability/external-reservations/bulk-import')
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        unitId,
        sourceCode: 'OTHER',
        rows: [
          { dateFrom: '2027-05-01', dateTo: '2027-05-02', quantity: 1 },
          { dateFrom: '2027-05-01', dateTo: '2027-05-02', quantity: 1 },
        ],
      });
    expect(res.status).toBe(200);
    const statuses = res.body.data.results.map((r) => r.status);
    expect(statuses).toContain('CREATED');
    expect(statuses).toContain('FAILED');
  });

  test("bulk-import is rejected for a customer on another partner's unpublished listing", async () => {
    const listingId = await createListing(`Bulk Import RBAC ${Date.now()}`);
    const unitId = await registerUnit(listingId, 5);

    const res = await request(app)
      .post('/api/v1/availability/external-reservations/bulk-import')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        unitId,
        sourceCode: 'OTHER',
        rows: [{ dateFrom: '2027-06-01', dateTo: '2027-06-02' }],
      });
    expect(res.status).toBe(404);
  });
});
