/**
 * P0.5 (Master Roadmap) — Inventory sync conflict safety regression.
 *
 * Before this fix, `IcalConnector#importAvailability` called
 * `applyReservation` unwrapped inside its per-event loop: a genuine
 * `AVAILABILITY_CONFLICT` thrown by `AvailabilityService
 * #applySystemExternalReservation` propagated straight out of the whole
 * `withTransaction(...)` call in `InventoryConnectionService#executeSync`,
 * which rolled back the ENTIRE sync run — including every other valid
 * event already applied earlier in the same feed — and marked the run
 * FAILED with zero rows in `inventory_sync_conflicts`, even though the
 * spec's own `conflicts` array/`PARTIAL` status mechanism existed and was
 * wired up correctly one layer up. These tests exercise the real HTTP
 * surface (not a mock) against the real `ICAL` connector using
 * `config.fixtureIcs` — the exact mechanism this codebase's own demo
 * seeding and connector doc comments describe as equivalent to a real
 * `feedUrl` fetch — so this is a genuine, not simulated, regression test.
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
let partnerId;
let languageId;

function toIcsDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function buildIcs(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0'];
  events.forEach(({ uid, from, to, summary }) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${toIcsDate(from)}`,
      `DTEND;VALUE=DATE:${toIcsDate(to)}`,
      `SUMMARY:${summary}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

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

async function registerUnit(listingId, capacity = 1) {
  const res = await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId, bookableUnitType: 'HOTEL_ROOM', capacity });
  return res.body.data.id;
}

async function createIcalConnection(listingId, fixtureIcs) {
  const res = await request(app)
    .post('/api/v1/inventory-connections')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingId,
      connectorType: 'ICAL',
      direction: 'IMPORT',
      name: `Conflict safety test ${Date.now()}`,
      config: { fixtureIcs },
    });
  return res.body.data;
}

async function setFixtureIcs(connectionId, fixtureIcs) {
  await request(app)
    .patch(`/api/v1/inventory-connections/${connectionId}`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ config: { fixtureIcs } });
}

async function mapDefault(connectionId, unitId) {
  await request(app)
    .post(`/api/v1/inventory-connections/${connectionId}/mapping`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ externalResourceId: 'default', bookableUnitId: unitId });
}

async function sync(connectionId) {
  const res = await request(app)
    .post(`/api/v1/inventory-connections/${connectionId}/sync`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({});
  return res.body.data;
}

async function listConflicts(connectionId) {
  const res = await request(app)
    .get(`/api/v1/inventory-connections/${connectionId}/conflicts`)
    .set('Authorization', `Bearer ${vendor.accessToken}`);
  return res.body.data;
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
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Inventory sync conflict safety (P0.5)', () => {
  test('a genuine capacity conflict on one event does not discard other valid events in the same feed', async () => {
    const anchor = new Date('2027-03-01T00:00:00.000Z');
    const occupiedFrom = addDays(anchor, 10);
    const occupiedTo = addDays(anchor, 11);
    const freeFrom = addDays(anchor, 20);
    const freeTo = addDays(anchor, 21);

    const listingId = await createListing(`Conflict Safety ${Date.now()}`);
    const unitId = await registerUnit(listingId, 1);

    const firstFeed = buildIcs([
      {
        uid: 'EVT-A',
        from: occupiedFrom,
        to: occupiedTo,
        summary: 'Existing external reservation',
      },
    ]);
    const connection = await createIcalConnection(listingId, firstFeed);
    await mapDefault(connection.id, unitId);

    const firstRun = await sync(connection.id);
    expect(firstRun.status).toBe('SUCCESS');
    expect(firstRun.records_created).toBe(1);

    // Second sync: EVT-A stays (must not be treated as removed), EVT-B
    // genuinely conflicts with EVT-A's already-consumed capacity on the
    // same unit/dates, EVT-C is a real, unrelated, valid event.
    const secondFeed = buildIcs([
      {
        uid: 'EVT-A',
        from: occupiedFrom,
        to: occupiedTo,
        summary: 'Existing external reservation',
      },
      {
        uid: 'EVT-B',
        from: occupiedFrom,
        to: occupiedTo,
        summary: 'Conflicting double-booked reservation',
      },
      {
        uid: 'EVT-C',
        from: freeFrom,
        to: freeTo,
        summary: 'Unrelated valid reservation',
      },
    ]);
    await setFixtureIcs(connection.id, secondFeed);

    const secondRun = await sync(connection.id);

    // The whole run must report PARTIAL, not FAILED — the valid EVT-C
    // must still have synced.
    expect(secondRun.status).toBe('PARTIAL');
    expect(secondRun.records_created).toBe(1); // EVT-C
    expect(secondRun.conflicts_count).toBe(1); // EVT-B

    const conflicts = await listConflicts(connection.id);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].external_event_uid).toBe('EVT-B');
    expect(conflicts[0].conflict_type).toBe('CAPACITY_CONFLICT');

    // EVT-C's reservation genuinely exists — the connection did not
    // silently drop it.
    const [[evtC]] = await pool.query(
      `SELECT id FROM external_reservations
       WHERE connection_id = ? AND external_event_uid = 'EVT-C' AND cancelled_at IS NULL`,
      [connection.id],
    );
    expect(evtC).toBeDefined();

    // EVT-B never got an external_reservations row — the conflicting
    // event's partial writes were rolled back, not silently committed.
    const [[evtB]] = await pool.query(
      `SELECT id FROM external_reservations
       WHERE connection_id = ? AND external_event_uid = 'EVT-B'`,
      [connection.id],
    );
    expect(evtB).toBeUndefined();

    // A PARTIAL run still leaves the connection healthy/ACTIVE — the
    // spec's "never falsely claim broken, never falsely claim clean"
    // rule cuts both ways.
    const getRes = await request(app)
      .get(`/api/v1/inventory-connections/${connection.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(getRes.body.data.status).toBe('ACTIVE');
    expect(getRes.body.data.last_successful_sync_at).not.toBeNull();

    // Retry: re-running the identical feed is idempotent for the
    // already-imported events and deterministically reports the same
    // still-unresolved conflict again, rather than erroring or losing
    // EVT-C.
    const thirdRun = await sync(connection.id);
    expect(thirdRun.status).toBe('PARTIAL');
    expect(thirdRun.records_created).toBe(0); // EVT-A/EVT-C already imported
    expect(thirdRun.conflicts_count).toBe(1); // EVT-B still conflicts

    // Removed-event reconciliation: dropping EVT-C from the feed
    // releases its capacity, and EVT-B (still absent room) still
    // resolves to conflict rather than erroring the whole run.
    const fourthFeed = buildIcs([
      {
        uid: 'EVT-A',
        from: occupiedFrom,
        to: occupiedTo,
        summary: 'Existing external reservation',
      },
      {
        uid: 'EVT-B',
        from: occupiedFrom,
        to: occupiedTo,
        summary: 'Conflicting double-booked reservation',
      },
    ]);
    await setFixtureIcs(connection.id, fourthFeed);
    const fourthRun = await sync(connection.id);
    expect(fourthRun.status).toBe('PARTIAL');
    expect(fourthRun.conflicts_count).toBe(1);

    const [[evtCAfterRemoval]] = await pool.query(
      `SELECT id, cancelled_at FROM external_reservations
       WHERE connection_id = ? AND external_event_uid = 'EVT-C'`,
      [connection.id],
    );
    expect(evtCAfterRemoval.cancelled_at).not.toBeNull();
  });

  test('an all-conflicting feed still reports PARTIAL (never FAILED) and records every conflict', async () => {
    const anchor = new Date('2027-04-01T00:00:00.000Z');
    const occupiedFrom = addDays(anchor, 5);
    const occupiedTo = addDays(anchor, 6);

    const listingId = await createListing(`All Conflict ${Date.now()}`);
    const unitId = await registerUnit(listingId, 1);

    const connection = await createIcalConnection(
      listingId,
      buildIcs([
        { uid: 'SOLO-A', from: occupiedFrom, to: occupiedTo, summary: 'A' },
      ]),
    );
    await mapDefault(connection.id, unitId);
    const firstRun = await sync(connection.id);
    expect(firstRun.status).toBe('SUCCESS');

    await setFixtureIcs(
      connection.id,
      buildIcs([
        { uid: 'SOLO-A', from: occupiedFrom, to: occupiedTo, summary: 'A' },
        { uid: 'SOLO-B', from: occupiedFrom, to: occupiedTo, summary: 'B' },
      ]),
    );
    const secondRun = await sync(connection.id);

    expect(secondRun.status).toBe('PARTIAL');
    expect(secondRun.records_created).toBe(0);
    expect(secondRun.conflicts_count).toBe(1);

    const getRes = await request(app)
      .get(`/api/v1/inventory-connections/${connection.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(getRes.body.data.status).toBe('ACTIVE');
  });
});
