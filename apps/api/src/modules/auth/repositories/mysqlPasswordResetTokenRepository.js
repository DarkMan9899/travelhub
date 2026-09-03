/**
 * MySQL implementation of the password-reset-token store.
 *
 * Owns the `password_reset_tokens` table (migration 0036) — mirrors
 * `mysqlRefreshTokenRepository.js`'s hash-only-storage shape and
 * `partnerStaffService.js`'s invitation-token idiom (see that file's own
 * header comment: "no prior invitation/token-with-expiry pattern exists
 * anywhere in this codebase to reuse — the closest precedent is the
 * refresh-token idiom"). This is the same idiom's second application: a
 * single-use, expiring, hash-only-stored token, this time for password
 * reset rather than session refresh or a staff invitation.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';

const SELECT_COLUMNS = `
  id, user_id, token_hash, expires_at, used_at, created_at
`;

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

export class MySqlPasswordResetTokenRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create({ userId, tokenHash, expiresAt }, connection = this.#pool) {
    try {
      const [result] = await connection.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
        [userId, tokenHash, expiresAt],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} FROM password_reset_tokens WHERE id = ? LIMIT 1`,
      [id],
    );
    return toDomain(rows[0]);
  }

  async findByTokenHash(tokenHash, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} FROM password_reset_tokens WHERE token_hash = ? LIMIT 1`,
      [tokenHash],
    );
    return toDomain(rows[0]);
  }

  async markUsed(id, connection = this.#pool) {
    await connection.query(
      'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [id],
    );
  }

  /**
   * Invalidates every other still-usable token for this user — called
   * both when a fresh reset is requested (an old, unused link a user
   * abandoned must not keep working once a new one is issued) and right
   * after a successful reset (defense in depth: a second, still-valid
   * token for the account that was just secured should not silently
   * remain usable). "Invalidate" here means delete outright rather than
   * an extra `revoked_at` column — an already-invalidated row has no
   * further use (unlike `refresh_tokens.revoked_at`, which the reuse-
   * detection flow specifically needs to distinguish "revoked" from
   * "never existed").
   */
  async invalidateAllForUser(userId, connection = this.#pool) {
    await connection.query(
      'DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL',
      [userId],
    );
  }
}

export default MySqlPasswordResetTokenRepository;
