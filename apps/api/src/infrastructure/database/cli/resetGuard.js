/**
 * `npm run db:reset` — intentionally disabled.
 *
 * This used to run `src/infrastructure/database/reset.js` directly,
 * which dropped and recreated whatever `config.database.name` resolved
 * to for the ambient NODE_ENV — almost always `development`, since
 * nothing about a bare `node reset.js` invocation ever set
 * NODE_ENV=test. That is exactly how a `db:reset` run silently wiped a
 * local development database instead of the disposable test one it was
 * assumed to target.
 *
 * This script never touches a database — it only points the caller at
 * the two explicit, unambiguous replacements.
 */

console.error(`
✖ "db:reset" is disabled — it used to silently target whichever database
  NODE_ENV happened to resolve to (almost always your LOCAL DEVELOPMENT
  database), which is exactly the kind of mistake this guard exists to
  prevent.

Use one of the explicit commands instead:

    npm run db:reset:test
        Resets the disposable integration-test fixture database. Safe,
        no confirmation needed — it only ever holds throwaway data.

    npm run db:reset:dev -- --confirm
        Resets your LOCAL DEVELOPMENT database. Destructive. Requires
        the --confirm flag every time; refuses to run without it.
`);

process.exitCode = 1;
