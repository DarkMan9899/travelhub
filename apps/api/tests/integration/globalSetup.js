/**
 * Jest globalSetup for the `integration` project (Sprint 5 "test database
 * isolation") — ensures the isolated test database (DATABASE_NAME_TEST)
 * exists on the MySQL server before any integration test file connects to
 * it. Runs once, before any test file, in a separate process from the
 * tests themselves (Jest's globalSetup contract) — it re-derives
 * connection parameters directly from environment variables rather than
 * importing src/config/index.js's singleton, since globalSetup does not
 * share module state with the test files it precedes.
 *
 * `import 'dotenv/config'` is still needed despite not importing the
 * config singleton itself — this process never otherwise loads `.env`
 * (Jest's globalSetup runs in its own isolated process, before any test
 * file's own `src/config/index.js` import would trigger it), so without
 * this line every DATABASE_* default below silently falls back to the
 * bogus 'travelhub'/'' placeholder instead of the real local credentials.
 *
 * Fail-fast safety net: `package.json`'s `test:integration`/`test:contract`
 * scripts now explicitly set NODE_ENV=test (rather than relying on Jest's
 * own implicit default), and this file asserts that landed correctly
 * before creating anything — every integration test file that follows
 * imports `src/config/index.js`, whose `database.name` branches on this
 * exact same NODE_ENV check, so a wrong NODE_ENV here would otherwise
 * only surface once a test file starts running real queries.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export default async function globalSetup() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `Integration tests require NODE_ENV=test, but it is "${process.env.NODE_ENV}". ` +
        'Run via `npm run test:integration` (which sets this explicitly) ' +
        'rather than invoking Jest directly.',
    );
  }

  const host = process.env.DATABASE_HOST || 'localhost';
  const port = Number(process.env.DATABASE_PORT || 3306);
  const user = process.env.DATABASE_USER || 'travelhub';
  const password = process.env.DATABASE_PASSWORD || '';
  const database = process.env.DATABASE_NAME_TEST || 'travelhub_test';

  if (!IDENTIFIER.test(database)) {
    throw new Error(
      `DATABASE_NAME_TEST "${database}" is not a valid database identifier.`,
    );
  }

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}
