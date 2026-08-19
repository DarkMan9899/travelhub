/**
 * `npm run db:backup:verify -- --file=<path-to-dump.sql>` — P0.9 (Master
 * Roadmap): proves a backup file is genuinely restorable, without ever
 * touching a real database. Restores the dump into a throwaway,
 * randomly-named scratch database (`travelhub_backup_verify_<random>`),
 * runs a basic sanity check (every expected core table exists and has at
 * least one row), then drops the scratch database in a `finally` — safe
 * by construction, not by convention: there is no code path in this
 * script that writes to `config.database.name` or any pre-existing
 * database at all.
 *
 * This is the "restore verification" step docs/OPERATIONS_BACKUP_RESTORE.md
 * calls for: a backup nobody has ever successfully restored is not a
 * real backup, just an assumption.
 */

import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

const { getModuleLogger } = await import('../../../logging/logger.js');

const log = getModuleLogger('infrastructure:db-backup-verify');

const MYSQL_BIN = process.env.MYSQL_BIN || 'mysql';
// A representative sample, not every table — enough to catch a truncated
// or empty dump without hardcoding this schema's entire table list here.
const SANITY_CHECK_TABLES = ['users', 'partners', 'listings', 'bookings'];

function parseArgs(argv) {
  const fileArg = argv.find((arg) => arg.startsWith('--file='));
  if (!fileArg) {
    throw new Error('Usage: node verifyBackup.js --file=<path-to-dump.sql>');
  }
  return { file: fileArg.slice('--file='.length) };
}

async function main() {
  const { file } = parseArgs(process.argv.slice(2));
  const { default: config } = await import('../../../config/index.js');

  const scratchDatabase = `travelhub_backup_verify_${randomBytes(4).toString('hex')}`;
  const connectionOpts = {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
  };

  const adminConnection = await mysql.createConnection(connectionOpts);
  try {
    log.info(
      { file, scratchDatabase },
      'db:backup:verify — creating scratch database',
    );
    await adminConnection.query(
      `CREATE DATABASE \`${scratchDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );

    log.info({ file, scratchDatabase }, 'db:backup:verify — restoring dump');
    await new Promise((resolve, reject) => {
      const child = execFile(
        MYSQL_BIN,
        [
          `--host=${config.database.host}`,
          `--port=${config.database.port}`,
          `--user=${config.database.user}`,
          scratchDatabase,
        ],
        {
          env: { ...process.env, MYSQL_PWD: config.database.password },
          maxBuffer: 1024 * 1024 * 1024,
        },
        (err) => (err ? reject(err) : resolve()),
      );
      createReadStream(file).pipe(child.stdin);
    });

    const results = {};
    for (const table of SANITY_CHECK_TABLES) {
      // eslint-disable-next-line no-await-in-loop -- small, fixed, sequential sanity-check list
      const [rows] = await adminConnection.query(
        `SELECT COUNT(*) AS count FROM \`${scratchDatabase}\`.\`${table}\``,
      );
      results[table] = rows[0].count;
    }

    const emptyTables = Object.entries(results).filter(
      ([, count]) => count === 0,
    );
    if (emptyTables.length > 0) {
      throw new Error(
        `Restored, but these tables are unexpectedly empty: ${emptyTables.map(([t]) => t).join(', ')}. ` +
          'This backup may be truncated or was taken against an empty database.',
      );
    }

    log.info(
      { file, scratchDatabase, rowCounts: results },
      'db:backup:verify PASSED — the backup is genuinely restorable',
    );
  } finally {
    await adminConnection.query(
      `DROP DATABASE IF EXISTS \`${scratchDatabase}\``,
    );
    await adminConnection.end();
  }
}

try {
  await main();
} catch (err) {
  log.error({ err }, 'db:backup:verify FAILED');
  process.exitCode = 1;
}
