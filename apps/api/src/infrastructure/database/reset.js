/**
 * Development-only full reset: drop + recreate the configured database,
 * migrate from empty, then seed.
 *
 * Never runs when `NODE_ENV=production` — this is a destructive operation
 * with no confirmation prompt, so the guard is a hard failure, not a
 * warning (`db:reset` is a local-dev convenience script, never part of a
 * deployment pipeline).
 */

import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import config from '../../config/index.js';
import { getModuleLogger } from '../../logging/logger.js';
import { up } from './migrate.js';
import { seedAll } from './seeds/index.js';

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

async function main() {
  if (config.isProduction) {
    log.error('db:reset refuses to run when NODE_ENV=production.');
    process.exitCode = 1;
    return;
  }

  await recreateDatabase();
  await up();
  await seedAll();
  log.info('db:reset complete');
}

// Guards against running as a side effect of import (e.g. a test file
// importing `recreateDatabase` from this module) — only runs when
// invoked directly, matching migrate.js/seeds/index.js's own guard.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    log.error({ err }, 'db:reset failed');
    process.exitCode = 1;
  });
}
