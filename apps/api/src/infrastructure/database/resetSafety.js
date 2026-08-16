/**
 * Pure, unit-testable safety checks for the destructive `db:reset:dev`
 * CLI (see `cli/resetDev.js`). Extracted from that script so the actual
 * gating logic — the part that decides whether a DROP DATABASE against
 * a developer's local dev database is allowed to proceed — has an
 * automated test, not just a manual read-through.
 */

const CONFIRM_FLAGS = ['--confirm', '--yes'];

/** Has the caller passed an explicit confirmation flag on the command line? */
export function isDevResetConfirmed(argv) {
  return argv.some((arg) => CONFIRM_FLAGS.includes(arg));
}

/**
 * A resolved database name is only ever a safe target for the *test*
 * reset path if it plainly looks like a test database. This is a second,
 * independent guard on top of NODE_ENV/DATABASE_NAME_TEST resolution —
 * defense in depth against a misconfigured `.env` pointing
 * DATABASE_NAME_TEST at something that isn't actually a disposable
 * fixture database.
 */
export function looksLikeTestDatabase(databaseName) {
  return /test/i.test(databaseName);
}
