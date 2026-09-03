/**
 * Jest globalSetup for the `integration` project (Sprint 5 "test database
 * isolation") — resets the isolated test database (DATABASE_NAME_TEST) to
 * a clean, migrated, freshly-seeded state before any integration test
 * file connects to it. Runs once, before any test file, in a separate
 * process from the tests themselves (Jest's globalSetup contract).
 *
 * Full reset (drop + recreate + migrate + seed), not merely "create if
 * missing" (that was this file's original, narrower behavior): every
 * individual test file's own `beforeAll` creates real, permanent rows
 * (listings, bookings, users, ...) via `up()`/`seedAll()`, which are
 * idempotent for *lookup* data but never truncate anything — so on a
 * database that merely "exists" across many prior runs, that fixture data
 * accumulates forever. Two concrete, previously-diagnosed failure classes
 * traced directly to this: (1) several `search*` integration suites colliding
 * on slugs/ids left behind by earlier runs, and (2) `tests/integration/ai/
 * tripPlanner.test.js` failing once enough accumulated low-priced listings
 * from other suites' fixtures exhausted its trip budget before its own
 * fixture listing was ever reached. A full reset here — once per full
 * `npx jest --selectProjects integration` invocation, not once per test
 * file — gives every run the same deterministic starting point, which is
 * the actual fix for both: this suite no longer depends on what any
 * previous run (today or six months ago) happened to leave behind.
 *
 * Reuses `recreateDatabase()` (already the exact mechanism `db:reset:test`
 * uses) plus the same `looksLikeTestDatabase` defense-in-depth guard that
 * command already relies on, rather than re-implementing either — this
 * file already asserted `NODE_ENV=test` below before any of it existed,
 * so this is strictly additive safety, not a replacement for it.
 *
 * Unlike this file's previous version, `src/config/index.js`'s singleton
 * IS now imported deliberately (after confirming NODE_ENV=test below) —
 * `recreateDatabase()`/`up()`/`seedAll()` all resolve their target through
 * it internally, and duplicating that resolution by hand here (as the
 * former bare `mysql.createConnection` block did) would be one more place
 * a future config change could silently drift out of sync.
 */

import 'dotenv/config';

export default async function globalSetup() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Integration tests require NODE_ENV=test, but it is "${process.env.NODE_ENV}". ` +
        'Run via `npm run test:integration` (which sets this explicitly) ' +
        'rather than invoking Jest directly.',
    );
  }

  const { default: config } = await import('../../src/config/index.js');
  const { looksLikeTestDatabase } =
    await import('../../src/infrastructure/database/resetSafety.js');
  const { recreateDatabase } =
    await import('../../src/infrastructure/database/reset.js');
  const { up } = await import('../../src/infrastructure/database/migrate.js');
  const { seedAll } =
    await import('../../src/infrastructure/database/seeds/index.js');
  const { closeMysqlPool } =
    await import('../../src/infrastructure/database/mysqlPool.js');

  if (!looksLikeTestDatabase(config.database.name)) {
    throw new Error(
      `Refusing to reset "${config.database.name}" — it doesn't look like ` +
        'a test database. Check DATABASE_NAME_TEST in your .env.',
    );
  }

  try {
    await recreateDatabase();
    await up();
    await seedAll();
  } finally {
    await closeMysqlPool();
  }
}
