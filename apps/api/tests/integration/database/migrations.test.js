/**
 * Sprint 5 Quality Gate item 4: "Validate a fresh database migration from
 * an empty database." Drops + recreates a dedicated, disposable
 * `travelhub_test_migration_check` database, runs every migration from
 * scratch, and asserts the resulting schema is complete — the only way
 * to genuinely prove migrations 0001-0011 apply cleanly in order with no
 * missing dependency.
 *
 * Deliberately does NOT run this against the shared `travelhub_test`
 * database (DATABASE_NAME_TEST): every other integration test file in
 * the same `--runInBand` run shares that database, self-seeding it via
 * up()+seedAll() in its own beforeAll. Dropping *that* database mid-suite
 * left the run's outcome dependent on file execution order and could
 * cascade "Unknown database" failures into whichever files happened to
 * run next. Using an isolated, throwaway database name for this one
 * destructive check keeps it fully independent of the rest of the suite.
 */

import { describe, test, expect, afterAll } from '@jest/globals';
import config from '../../../src/config/index.js';
import {
  recreateDatabase,
  dropDatabase,
} from '../../../src/infrastructure/database/reset.js';
import {
  up,
  listMigrations,
} from '../../../src/infrastructure/database/migrate.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';

const MIGRATION_CHECK_DATABASE = 'travelhub_test_migration_check';

afterAll(async () => {
  await dropDatabase(MIGRATION_CHECK_DATABASE);
  await closeMysqlPool();
}, 60_000);

describe('Fresh migration from an empty database (Sprint 5 Quality Gate #4)', () => {
  test('every migration applies cleanly, in order, against a brand-new database', async () => {
    // Safety net: this test drops the database it connects to — never
    // let it run against anything but its own dedicated, disposable
    // database, and never the shared database the rest of the suite uses.
    expect(config.isTest).toBe(true);
    expect(MIGRATION_CHECK_DATABASE).not.toBe(config.database.name);

    await recreateDatabase(MIGRATION_CHECK_DATABASE);
    await up(undefined, { databaseName: MIGRATION_CHECK_DATABASE });

    const pool = getMysqlPool();
    const [rows] = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [MIGRATION_CHECK_DATABASE],
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
      `SELECT version FROM \`${MIGRATION_CHECK_DATABASE}\`.schema_migrations ORDER BY version`,
    );
    const appliedVersions = rows.map((row) => row.version);
    const allMigrations = listMigrations();

    expect(appliedVersions).toHaveLength(allMigrations.length);
    expect(new Set(appliedVersions).size).toBe(appliedVersions.length);
  });

  test('re-running "up" against an already-migrated database is a no-op (idempotent)', async () => {
    await expect(
      up(undefined, { databaseName: MIGRATION_CHECK_DATABASE }),
    ).resolves.not.toThrow();
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count FROM \`${MIGRATION_CHECK_DATABASE}\`.schema_migrations`,
    );
    expect(Number(rows[0].count)).toBe(listMigrations().length);
  });
});
