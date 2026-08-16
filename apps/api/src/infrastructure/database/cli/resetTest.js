/**
 * `npm run db:reset:test` — the ONLY safe, no-confirmation-needed reset
 * command. Always targets the disposable integration-test fixture
 * database (`DATABASE_NAME_TEST`, default `travelhub_test`), never the
 * developer's local database, regardless of whatever NODE_ENV/DATABASE_
 * NAME happen to already be set to in the calling shell.
 *
 * Forces `process.env.NODE_ENV = 'test'` as the very first statement,
 * before anything that reads config is imported. Because these are
 * dynamic `import()` calls (not static `import` declarations, which ES
 * modules hoist above all other top-level code), the assignment below
 * genuinely runs first — `src/config/index.js` only computes
 * `database.name` once it's actually loaded, by which point NODE_ENV is
 * already 'test'. A second, independent check
 * (`looksLikeTestDatabase`) then refuses to proceed even in the
 * unlikely case that `DATABASE_NAME_TEST` itself was misconfigured to
 * point at something that doesn't look like a test database.
 */

process.env.NODE_ENV = 'test';

const { default: config } = await import('../../../config/index.js');
const { getModuleLogger } = await import('../../../logging/logger.js');
const { recreateDatabase } = await import('../reset.js');
const { up } = await import('../migrate.js');
const { seedAll } = await import('../seeds/index.js');
const { closeMysqlPool } = await import('../mysqlPool.js');
const { looksLikeTestDatabase } = await import('../resetSafety.js');

const log = getModuleLogger('infrastructure:db-reset-test');

async function main() {
  if (!config.isTest) {
    // Should be unreachable — NODE_ENV was just forced above — but a
    // hard failure here is cheap insurance against this file somehow
    // being imported after some other module already cached a
    // different NODE_ENV-derived config singleton.
    throw new Error(
      `Expected NODE_ENV=test to be in effect, but config.isTest is false.`,
    );
  }
  if (!looksLikeTestDatabase(config.database.name)) {
    throw new Error(
      `Refusing to reset "${config.database.name}" — it doesn't look ` +
        `like a test database. Check DATABASE_NAME_TEST in your .env.`,
    );
  }

  log.info(
    { database: config.database.name, host: config.database.host },
    'db:reset:test — resetting the disposable test database',
  );
  await recreateDatabase();
  await up();
  await seedAll();
  log.info('db:reset:test complete');
}

try {
  await main();
} catch (err) {
  log.error({ err }, 'db:reset:test failed');
  process.exitCode = 1;
} finally {
  await closeMysqlPool();
}
