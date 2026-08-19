/**
 * `npm run db:backup` — P0.9 (Master Roadmap): a real, working,
 * non-destructive `mysqldump` wrapper. Targets whatever
 * `config.database.name` currently resolves to (dev by default; pass
 * NODE_ENV=test to back up the disposable test database instead — there
 * is no reason to, but nothing stops you). Never touches any database
 * other than the one it reads from; never overwrites an existing backup
 * file (timestamped filenames make that structurally true, not just a
 * convention).
 *
 * `--single-transaction` takes a consistent InnoDB snapshot without
 * locking any table for the dump's duration (every table in this schema
 * is InnoDB — see any migration's `ENGINE=InnoDB`). The password is
 * passed via the `MYSQL_PWD` environment variable to the child process,
 * not a `--password=` CLI flag, so it never appears in a process list.
 *
 * See docs/OPERATIONS_BACKUP_RESTORE.md for the full backup/restore
 * procedure this script is one piece of.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const { default: config } = await import('../../../config/index.js');
const { getModuleLogger } = await import('../../../logging/logger.js');

const log = getModuleLogger('infrastructure:db-backup');

const MYSQLDUMP_BIN = process.env.MYSQLDUMP_BIN || 'mysqldump';
const OUTPUT_DIR =
  process.env.DB_BACKUP_DIR || path.resolve(process.cwd(), 'backups');

function timestampedFilename(databaseName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${databaseName}_${stamp}.sql`;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(
    OUTPUT_DIR,
    timestampedFilename(config.database.name),
  );

  log.info(
    { database: config.database.name, host: config.database.host, outputPath },
    'db:backup starting',
  );

  const startedAt = Date.now();
  await execFileAsync(
    MYSQLDUMP_BIN,
    [
      `--host=${config.database.host}`,
      `--port=${config.database.port}`,
      `--user=${config.database.user}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      `--result-file=${outputPath}`,
      config.database.name,
    ],
    {
      env: { ...process.env, MYSQL_PWD: config.database.password },
      maxBuffer: 1024 * 1024 * 1024, // mysqldump's own stderr/progress, not the dump itself (that goes to --result-file)
    },
  );

  const { size } = await stat(outputPath);
  log.info(
    {
      database: config.database.name,
      outputPath,
      bytes: size,
      durationMs: Date.now() - startedAt,
    },
    'db:backup complete',
  );
}

try {
  await main();
} catch (err) {
  log.error({ err }, 'db:backup failed');
  process.exitCode = 1;
}
