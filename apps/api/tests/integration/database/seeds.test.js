/**
 * Sprint 5 §17: "seed determinism." Runs the full seed pipeline twice
 * against an already-migrated database and asserts the second run
 * neither errors nor changes row counts in any seeded table — the
 * definition of "deterministic seed data" (Sprint 5 §15).
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';

const SEEDED_TABLES = [
  'user_statuses',
  'moderation_statuses',
  'partner_employee_roles',
  'listing_statuses',
  'listing_types',
  'media_types',
  'media_upload_statuses',
  'bookable_unit_types',
  'availability_statuses',
  'booking_types',
  'booking_statuses',
  'payment_statuses',
  'ad_placement_types',
  'advertisement_statuses',
  'languages',
  'currencies',
  'countries',
  'regions',
  'cities',
  'listing_categories',
  'listing_amenities',
  'ad_products',
  'roles',
  'permissions',
  'permission_role',
  'users',
  'partners',
  'partner_employees',
  'role_user',
];

async function countRows(pool, table) {
  const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(rows[0].count);
}

beforeAll(async () => {
  await up();
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
});

describe('Seed determinism (Sprint 5 §15/§17)', () => {
  test('seedAll() runs twice without error and produces identical row counts', async () => {
    const pool = getMysqlPool();

    await seedAll();
    const countsAfterFirstRun = {};
    // eslint-disable-next-line no-restricted-syntax -- must read each table in a stable, readable order
    for (const table of SEEDED_TABLES) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      countsAfterFirstRun[table] = await countRows(pool, table);
    }

    await expect(seedAll()).resolves.not.toThrow();

    // eslint-disable-next-line no-restricted-syntax -- must read each table in a stable, readable order
    for (const table of SEEDED_TABLES) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      const countAfterSecondRun = await countRows(pool, table);
      expect(countAfterSecondRun).toBe(countsAfterFirstRun[table]);
    }
  }, 60_000);

  test('every booking_statuses row from Sprint 5 §9 is present after seeding', async () => {
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      'SELECT code FROM booking_statuses ORDER BY code',
    );
    const codes = rows.map((row) => row.code).sort();
    expect(codes).toEqual(
      [
        'CANCELLED_BY_CUSTOMER',
        'CANCELLED_BY_VENDOR',
        'COMPLETED',
        'CONFIRMED',
        'DRAFT',
        'EXPIRED',
        'NO_SHOW',
        'PENDING_VENDOR',
        'REJECTED',
      ].sort(),
    );
  });

  test('every payment_statuses row from Sprint 5 §9 is present after seeding', async () => {
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      'SELECT code FROM payment_statuses ORDER BY code',
    );
    expect(rows.map((row) => row.code).sort()).toEqual(
      [
        'NOT_REQUIRED_ON_PLATFORM',
        'PAY_AT_PROPERTY',
        'PAID_OFFLINE',
        'REFUNDED_OFFLINE',
      ].sort(),
    );
  });

  test('dev accounts exist with the documented roles after seeding', async () => {
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      `SELECT u.normalized_email, r.code AS role_code
       FROM users u
       JOIN role_user ru ON ru.user_id = u.id
       JOIN roles r ON r.id = ru.role_id
       WHERE u.normalized_email IN (?, ?, ?)`,
      ['admin@travelhub.dev', 'vendor@travelhub.dev', 'customer@travelhub.dev'],
    );
    const rolesByEmail = Object.fromEntries(
      rows.map((row) => [row.normalized_email, row.role_code]),
    );
    expect(rolesByEmail['admin@travelhub.dev']).toBe('SUPER_ADMIN');
    expect(rolesByEmail['vendor@travelhub.dev']).toBe('CUSTOMER');
    expect(rolesByEmail['customer@travelhub.dev']).toBe('CUSTOMER');
  });
});
