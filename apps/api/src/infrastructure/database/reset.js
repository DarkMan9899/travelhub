/**
 * Library-only module: drop (+ optionally recreate) a database on the
 * configured MySQL server. Exports `recreateDatabase()` and
 * `dropDatabase()`; it has **no CLI entry point of its own** on purpose.
 *
 * This file used to also run as a script (`node reset.js` / the old bare
 * `npm run db:reset`), which meant its destructive DROP DATABASE ran
 * against whatever `config.database.name` happened to resolve to for
 * the *ambient* NODE_ENV — almost always `development`, since nothing
 * about running this file directly ever set NODE_ENV=test. That is
 * precisely how a `db:reset` invocation ended up dropping the local
 * development database instead of the disposable test one. The CLI
 * entry points now live in `cli/resetTest.js` (always test, no
 * confirmation needed) and `cli/resetDev.js` (always dev, refuses to
 * run without an explicit `--confirm` flag) — each explicitly resolves
 * its own target rather than trusting ambient environment state. The
 * bare `db:reset` script now points at `cli/resetGuard.js`, which never
 * touches a database at all.
 *
 * Both functions default to `config.database.name` but accept an
 * explicit `databaseName` override. `tests/integration/database/
 * migrations.test.js` relies on that override: it runs its
 * drop-and-migrate-from-scratch check against a dedicated
 * `travelhub_test_migration_check` database rather than the shared
 * `travelhub_test` database every other integration test file in the
 * same `--runInBand` process is concurrently reading/writing — dropping
 * the *shared* database mid-suite is exactly the isolation bug this
 * override exists to avoid.
 */

import mysql from 'mysql2/promise';
import config from '../../config/index.js';
import { getModuleLogger } from '../../logging/logger.js';

const log = getModuleLogger('infrastructure:db-reset');
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertValidIdentifier(databaseName) {
  if (!IDENTIFIER.test(databaseName)) {
    throw new Error(`"${databaseName}" is not a valid database identifier.`);
  }
}

async function withServerConnection(fn) {
  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
  });
  try {
    return await fn(connection);
  } finally {
    await connection.end();
  }
}

export async function recreateDatabase(databaseName = config.database.name) {
  assertValidIdentifier(databaseName);

  await withServerConnection(async (connection) => {
    await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    await connection.query(
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  });
  log.info({ database: databaseName }, 'Database dropped and recreated');
}

export async function dropDatabase(databaseName = config.database.name) {
  assertValidIdentifier(databaseName);

  await withServerConnection((connection) =>
    connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``),
  );
  log.info({ database: databaseName }, 'Database dropped');
}
