/**
 * MySQL-backed writer for `login_history` (append-only, migration 0002 —
 * `user_id` made nullable by migration 0013).
 *
 * Implements `API_SPECIFICATION.md` §27's business rule: "writes a
 * `login_history` row (success or failure) every attempt" — including an
 * attempt against an email that doesn't belong to any account
 * (`userId: null`), which is exactly why migration 0013 exists.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';

export class MySqlLoginHistoryRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async record(
    { userId = null, ipAddress = null, userAgent = null, success },
    connection = this.#pool,
  ) {
    await connection.query(
      'INSERT INTO login_history (user_id, ip_address, user_agent, success) VALUES (?, ?, ?, ?)',
      [userId, ipAddress, userAgent, success ? 1 : 0],
    );
  }
}

export default MySqlLoginHistoryRepository;
