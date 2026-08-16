/**
 * Library-only module: drop + recreate `config.database.name` (whatever
 * that currently resolves to — see `src/config/index.js`'s NODE_ENV
 * switch). Exports `recreateDatabase()` only; it has **no CLI entry
 * point of its own** on purpose.
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
 * `recreateDatabase()` itself is unchanged and still relied on directly
 * by `tests/integration/database/migrations.test.js`, which asserts
 * `config.database.name === 'travelhub_test'` (via Jest's own
 * NODE_ENV=test default) before calling it — that usage is safe and
 * intentionally untouched by this file's cleanup.
 */

import mysql from 'mysql2/promise';
import config from '../../config/index.js';
import { getModuleLogger } from '../../logging/logger.js';

const log = getModuleLogger('infrastructure:db-reset');
const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export async function recreateDatabase() {
  if (!IDENTIFIER.test(config.database.name)) {
    throw new Error(
      `"${config.database.name}" is not a valid database identifier.`,
    );
  }

  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
  });
  try {
    await connection.query(
      `DROP DATABASE IF EXISTS \`${config.database.name}\``,
    );
    await connection.query(
      `CREATE DATABASE \`${config.database.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    log.info(
      { database: config.database.name },
      'Database dropped and recreated',
    );
  } finally {
    await connection.end();
  }
}
