/**
 * `npm run db:reset:dev -- --confirm` — the explicit, guarded way to
 * drop and recreate the LOCAL DEVELOPMENT database. Refuses to run
 * without an explicit `--confirm` (or `--yes`) CLI flag: no interactive
 * prompt (a prompt can hang forever in a non-interactive shell/agent
 * context — the exact failure mode that made a previous unguarded
 * `db:reset` invocation look "stuck" for tens of minutes while it was
 * actually just waiting on stdin that would never arrive), and no
 * silent default — the caller must type the flag on purpose every time.
 *
 * Deliberately does NOT force NODE_ENV here (unlike `resetTest.js`) —
 * this script's whole point is to target whatever `config.database.name`
 * resolves to for the *default*, non-test environment (i.e.
 * `DATABASE_NAME`). If NODE_ENV=test is somehow already set when this
 * runs, that would make it silently reset the TEST database under a
 * "dev" label, which is its own kind of confusing — guarded against
 * below instead of relied upon.
 */

import { isDevResetConfirmed } from '../resetSafety.js';

const argv = process.argv.slice(2);

function printUsage() {
  console.error(`
✖ Refusing to reset the DEVELOPMENT database without explicit confirmation.

This drops and recreates your local development database, then re-runs
migrations and seeds. Any data beyond what the seed scripts create
(listings you created by hand via the Partner Wizard, manual test
bookings, etc.) will be permanently lost.

If you're sure, re-run with the --confirm flag:

    npm run db:reset:dev -- --confirm

If you meant to reset the disposable TEST database instead (no
confirmation needed — it only ever holds throwaway fixture data):

    npm run db:reset:test
`);
}

async function main() {
  if (!isDevResetConfirmed(argv)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (process.env.NODE_ENV === 'test') {
    console.error(
      '✖ NODE_ENV=test is set in this shell — refusing to run the DEV ' +
        'reset script in a test context. Use `npm run db:reset:test` ' +
        'instead, or unset NODE_ENV and re-run this command.',
    );
    process.exitCode = 1;
    return;
  }

  const { default: config } = await import('../../../config/index.js');
  const { getModuleLogger } = await import('../../../logging/logger.js');
  const { recreateDatabase } = await import('../reset.js');
  const { up } = await import('../migrate.js');
  const { seedAll } = await import('../seeds/index.js');
  const { closeMysqlPool } = await import('../mysqlPool.js');

  const log = getModuleLogger('infrastructure:db-reset-dev');

  if (config.isProduction) {
    log.error('db:reset:dev refuses to run when NODE_ENV=production.');
    process.exitCode = 1;
    return;
  }

  try {
    log.warn(
      { database: config.database.name, host: config.database.host },
      'db:reset:dev — dropping and recreating the development database',
    );
    await recreateDatabase();
    await up();
    await seedAll();
    log.info('db:reset:dev complete');
  } finally {
    await closeMysqlPool();
  }
}

try {
  await main();
} catch (err) {
  console.error('✖ db:reset:dev failed:', err);
  process.exitCode = 1;
}
