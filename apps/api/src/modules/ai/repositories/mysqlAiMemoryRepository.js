/**
 * MySQL-backed AI user-memory repository (Phase 15). Strictly user-scoped
 * key/value storage — every method requires a `userId`, there is no
 * "list across users" method anywhere in this file, by design (see
 * migration 0023's header comment on privacy).
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';

function toMemoryDomain(row) {
  return {
    key: row.memory_key,
    value:
      typeof row.memory_value === 'string'
        ? JSON.parse(row.memory_value)
        : row.memory_value,
    updatedAt: row.updated_at,
  };
}

export class MySqlAiMemoryRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async listForUser(userId) {
    const [rows] = await this.#pool.query(
      `SELECT memory_key, memory_value, updated_at FROM ai_user_memory WHERE user_id = ?`,
      [userId],
    );
    return rows.map(toMemoryDomain);
  }

  async get(userId, key) {
    const [rows] = await this.#pool.query(
      `SELECT memory_key, memory_value, updated_at FROM ai_user_memory
       WHERE user_id = ? AND memory_key = ? LIMIT 1`,
      [userId, key],
    );
    return rows[0] ? toMemoryDomain(rows[0]) : null;
  }

  async upsert(userId, key, value) {
    await this.#pool.query(
      `INSERT INTO ai_user_memory (user_id, memory_key, memory_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE memory_value = VALUES(memory_value)`,
      [userId, key, JSON.stringify(value)],
    );
  }

  /**
   * Increments a numeric counter stored at `memory_value.count` for
   * `(userId, key)`, creating the row with `count = 1` if absent — the
   * primitive `aiListener.js` uses to build destination-affinity counters
   * from real domain events, without a separate read-then-write round trip
   * racing a concurrent update.
   */
  async incrementCounter(userId, key, label) {
    await this.#pool.query(
      `INSERT INTO ai_user_memory (user_id, memory_key, memory_value)
       VALUES (?, ?, JSON_OBJECT('label', ?, 'count', 1))
       ON DUPLICATE KEY UPDATE
         memory_value = JSON_SET(memory_value, '$.count', COALESCE(JSON_EXTRACT(memory_value, '$.count'), 0) + 1)`,
      [userId, key, label],
    );
  }

  async delete(userId, key) {
    await this.#pool.query(
      `DELETE FROM ai_user_memory WHERE user_id = ? AND memory_key = ?`,
      [userId, key],
    );
  }
}

export default MySqlAiMemoryRepository;
