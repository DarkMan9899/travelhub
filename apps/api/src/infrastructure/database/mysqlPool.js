/**
 * MySQL connection pool.
 *
 * Implements the Repository layer's data-access foundation
 * (BACKEND_ARCHITECTURE.md §7): a single, shared connection pool used by
 * every module's concrete Repository implementations. Repositories are
 * the ONLY place in the codebase that imports this pool directly —
 * Services never do (BACKEND_ARCHITECTURE.md §3's Dependency Rule).
 *
 * Sprint 1 scope: the pool itself and a readiness-check query. No
 * schema, migrations, or Repository implementations exist yet — those
 * belong to DATABASE_ARCHITECTURE.md's migration process and each
 * module's own repositories/ folder in a later sprint.
 */

import mysql from 'mysql2/promise';
import config from '../../config/index.js';
import { getModuleLogger } from '../../logging/logger.js';

const log = getModuleLogger('infrastructure:mysql');

let pool;

export function getMysqlPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 3000,
      // InnoDB, per DATABASE_ARCHITECTURE.md — transactions and foreign
      // keys are expected; the pool itself makes no transaction
      // decisions (that is a Service-layer concern, BACKEND_ARCHITECTURE.md §40).
    });
    log.info('MySQL pool created');
  }
  return pool;
}

/**
 * Used by the readiness health check (BACKEND_ARCHITECTURE.md §50).
 * Wrapped in a hard timeout as defense-in-depth (same rationale as
 * pingRedis, src/infrastructure/cache/redisClient.js) so an unreachable
 * database fails this check fast rather than hanging the request.
 */
export async function pingMysql() {
  const db = getMysqlPool();
  let timer;
  try {
    await Promise.race([
      db.query('SELECT 1'),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('MySQL ping timed out')),
          3000,
        );
      }),
    ]);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

export async function closeMysqlPool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export default getMysqlPool;
