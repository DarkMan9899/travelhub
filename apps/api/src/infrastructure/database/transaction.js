/**
 * Transaction helper.
 *
 * Implements BACKEND_ARCHITECTURE.md §40: one MySQL transaction per
 * multi-table write, scoped to the smallest span that needs atomicity,
 * connection always released in a `finally` block regardless of outcome.
 * A Service opens a transaction by calling `withTransaction(fn)` and
 * passes the yielded connection into each Repository method it calls
 * inside the same unit of work — a transaction is never held open across
 * an external network call (validate before opening / trigger side
 * effects via a queued job after commit, per Ch.40).
 *
 * Default isolation is `REPEATABLE READ` (contended rows use explicit
 * `SELECT ... FOR UPDATE` inside the callback, never blanket
 * `SERIALIZABLE`, per Ch.40's stated rule).
 */

import { getMysqlPool } from './mysqlPool.js';

const ALLOWED_ISOLATION_LEVELS = new Set([
  'READ UNCOMMITTED',
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE',
]);

/**
 * @param {(connection: import('mysql2/promise').PoolConnection) => Promise<any>} fn
 * @param {object} [options]
 * @param {import('mysql2/promise').Pool} [options.pool]
 * @param {'READ UNCOMMITTED'|'READ COMMITTED'|'REPEATABLE READ'|'SERIALIZABLE'} [options.isolationLevel]
 */
export async function withTransaction(fn, options = {}) {
  const { pool = getMysqlPool(), isolationLevel = 'REPEATABLE READ' } = options;

  if (!ALLOWED_ISOLATION_LEVELS.has(isolationLevel)) {
    throw new TypeError(`Unknown isolation level "${isolationLevel}".`);
  }

  const connection = await pool.getConnection();
  try {
    // MySQL applies SET TRANSACTION ISOLATION LEVEL to the *next*
    // transaction on this connection, so it must run before START
    // TRANSACTION (issued by beginTransaction()) — this string is from
    // the fixed ALLOWED_ISOLATION_LEVELS allow-list above, never
    // caller-supplied SQL.
    await connection.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }
}

export default withTransaction;
