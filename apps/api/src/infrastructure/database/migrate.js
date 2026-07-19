/**
 * Versioned SQL migration runner.
 *
 * Implements Sprint 5's "versioned migrations" requirement using this
 * repository's already-chosen MySQL driver (`mysql2` —
 * `SPRINT_0_IMPLEMENTATION_PLAN.md`'s stated driver choice) rather than
 * introducing an ORM/migration framework the rest of the codebase doesn't
 * use (see `docs/SPRINT_5_DATABASE_FOUNDATION.md` "Architecture
 * Decisions" for the full rationale). Each domain group is one paired
 * `NNNN_name.up.sql` / `NNNN_name.down.sql` file under `migrations/`;
 * applied migrations are tracked in `schema_migrations` so re-running
 * `up` is always idempotent.
 *
 * Usage: node src/infrastructure/database/migrate.js <up|down|status> [n]
 *   up      - apply all pending migrations (or just the next `n`)
 *   down    - revert the most recently applied migration (or the last `n`)
 *   status  - list applied/pending migrations; exits 1 if any are pending
 *
 * Uses its own dedicated connection (`multipleStatements: true`) rather
 * than the shared app pool (`mysqlPool.js`) — that flag is a real
 * SQL-injection-surface risk on the app's request-serving connections, so
 * it is scoped to this one-off operational script only.
 *
 * IMPORTANT: MySQL DDL statements (CREATE TABLE, ALTER TABLE, ...) each
 * cause an implicit commit — MySQL has no transactional DDL. The
 * `beginTransaction`/`commit` below only guarantees the final
 * `schema_migrations` bookkeeping row commits atomically; if a migration
 * file fails partway through, any CREATE/ALTER statements that already
 * ran earlier in that same file are NOT rolled back. Every migration in
 * this project therefore uses `CREATE TABLE IF NOT EXISTS` / idempotent
 * DDL so a failed migration can be fixed and safely re-applied.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import config from '../../config/index.js';
import { getModuleLogger } from '../../logging/logger.js';

const log = getModuleLogger('infrastructure:migrate');
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(currentDir, 'migrations');
const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.up\.sql$/;

function listMigrations() {
  const files = readdirSync(MIGRATIONS_DIR).filter((file) =>
    file.endsWith('.up.sql'),
  );
  return files
    .map((file) => {
      const match = file.match(MIGRATION_FILE_PATTERN);
      if (!match) {
        throw new Error(
          `Migration file "${file}" does not match NNNN_name.up.sql`,
        );
      }
      const [, version, name] = match;
      return {
        version,
        name,
        upFile: file,
        downFile: `${version}_${name}.down.sql`,
      };
    })
    .sort((a, b) => a.version.localeCompare(b.version));
}

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      version VARCHAR(4) NOT NULL,
      name VARCHAR(255) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_schema_migrations_version UNIQUE (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function getAppliedVersions(connection) {
  const [rows] = await connection.query(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  return new Set(rows.map((row) => row.version));
}

function createConnection() {
  return mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    multipleStatements: true,
  });
}

async function runOne(connection, { sql, onSuccess }) {
  await connection.beginTransaction();
  try {
    await connection.query(sql);
    await onSuccess();
    await connection.commit();
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  }
}

async function up(steps) {
  const connection = await createConnection();
  try {
    await ensureMigrationsTable(connection);
    const applied = await getAppliedVersions(connection);
    const pending = listMigrations().filter(
      (migration) => !applied.has(migration.version),
    );
    const toRun = steps ? pending.slice(0, steps) : pending;

    if (toRun.length === 0) {
      log.info('No pending migrations.');
      return;
    }

    // eslint-disable-next-line no-restricted-syntax -- migrations must apply strictly in order
    for (const migration of toRun) {
      const sql = readFileSync(
        path.join(MIGRATIONS_DIR, migration.upFile),
        'utf8',
      );
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await runOne(connection, {
        sql,
        onSuccess: () =>
          connection.query(
            'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
            [migration.version, migration.name],
          ),
      });
      log.info({ migration: migration.upFile }, 'Migration applied');
    }
  } finally {
    await connection.end();
  }
}

async function down(steps = 1) {
  const connection = await createConnection();
  try {
    await ensureMigrationsTable(connection);
    const [rows] = await connection.query(
      'SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT ?',
      [steps],
    );

    if (rows.length === 0) {
      log.info('No migrations to revert.');
      return;
    }

    // eslint-disable-next-line no-restricted-syntax -- reverts must apply strictly in order
    for (const row of rows) {
      const downFile = `${row.version}_${row.name}.down.sql`;
      const sql = readFileSync(path.join(MIGRATIONS_DIR, downFile), 'utf8');
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await runOne(connection, {
        sql,
        onSuccess: () =>
          connection.query('DELETE FROM schema_migrations WHERE version = ?', [
            row.version,
          ]),
      });
      log.info({ migration: downFile }, 'Migration reverted');
    }
  } finally {
    await connection.end();
  }
}

async function status() {
  const connection = await createConnection();
  try {
    await ensureMigrationsTable(connection);
    const applied = await getAppliedVersions(connection);
    const all = listMigrations();
    const pending = all.filter((migration) => !applied.has(migration.version));

    log.info({ applied: applied.size, total: all.length }, 'Migration status');
    pending.forEach((migration) =>
      log.info({ migration: migration.upFile }, 'pending'),
    );

    return pending.length;
  } finally {
    await connection.end();
  }
}

async function main() {
  const [, , command, arg] = process.argv;
  const steps = arg ? Number(arg) : undefined;

  switch (command) {
    case 'up':
      await up(steps);
      break;
    case 'down':
      await down(steps ?? 1);
      break;
    case 'status': {
      const pendingCount = await status();
      if (pendingCount > 0) process.exitCode = 1;
      break;
    }
    default:
      log.error(`Unknown command "${command}". Use: up | down | status`);
      process.exitCode = 1;
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    log.error({ err }, 'Migration runner failed');
    process.exitCode = 1;
  });
}

export { up, down, status, listMigrations };
