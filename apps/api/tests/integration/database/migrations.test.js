/**
 * Sprint 5 Quality Gate item 4: "Validate a fresh database migration from
 * an empty database." Drops + recreates the isolated DATABASE_NAME_TEST
 * database, runs every migration from scratch, and asserts the resulting
 * schema is complete — the only way to genuinely prove migrations
 * 0001-0011 apply cleanly in order with no missing dependency.
 *
 * Runs against DATABASE_NAME_TEST only (see src/config/index.js's
 * NODE_ENV=test switch) — never point this suite at a database with real
 * data; it drops the database it connects to.
 */

import { describe, test, expect, afterAll } from '@jest/globals';
import config from '../../../src/config/index.js';
import { recreateDatabase } from '../../../src/infrastructure/database/reset.js';
import {
  up,
  listMigrations,
} from '../../../src/infrastructure/database/migrate.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';

afterAll(async () => {
  await closeMysqlPool();
});

describe('Fresh migration from an empty database (Sprint 5 Quality Gate #4)', () => {
  test('every migration applies cleanly, in order, against a brand-new database', async () => {
    // Safety net: this test drops the database it connects to — never
    // let it run against anything but the isolated test database.
    expect(config.isTest).toBe(true);
    expect(config.database.name).toBe('travelhub_test');

    await recreateDatabase();
    await up();

    const pool = getMysqlPool();
    const [rows] = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [config.database.name],
    );
    const tableNames = new Set(
      rows.map((row) => row.table_name ?? row.TABLE_NAME),
    );

    const expectedCoreTables = [
      'schema_migrations',
      'languages',
      'currencies',
      'countries',
      'regions',
      'cities',
      'users',
      'roles',
      'permissions',
      'role_user',
      'permission_role',
      'partners',
      'partner_employees',
      'addresses',
      'listing_categories',
      'tags',
      'listings',
      'listing_translations',
      'media',
      'bookable_units',
      'availability_calendar',
      'reservation_holds',
      'bookings',
      'booking_items',
      'booking_status_history',
      'reviews',
      'favorites',
      'advertisements',
      'audit_logs',
      'activity_logs',
    ];
    expectedCoreTables.forEach((table) => {
      expect(tableNames.has(table)).toBe(true);
    });
  }, 60_000);

  test('schema_migrations records exactly one row per migration file, none pending', async () => {
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    const appliedVersions = rows.map((row) => row.version);
    const allMigrations = listMigrations();

    expect(appliedVersions).toHaveLength(allMigrations.length);
    expect(new Set(appliedVersions).size).toBe(appliedVersions.length);
  });

  test('re-running "up" against an already-migrated database is a no-op (idempotent)', async () => {
    await expect(up()).resolves.not.toThrow();
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS count FROM schema_migrations',
    );
    expect(Number(rows[0].count)).toBe(listMigrations().length);
  });
});
