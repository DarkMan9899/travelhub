/**
 * MySQL implementation of the RefreshTokenRepository port.
 *
 * Owns the `refresh_tokens` table (migration 0012) — implements
 * `API_SPECIFICATION.md` §7's rotation/reuse-detection/logout-all
 * mechanics.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import { RefreshTokenRepository as RefreshTokenRepositoryPort } from '../../../core/interfaces/RefreshTokenRepository.js';

const SELECT_COLUMNS = `
  id, user_id, family_id, token_hash, device_label, replaced_by_token_id, revoked_at, expires_at, created_at
`;

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    tokenHash: row.token_hash,
    deviceLabel: row.device_label,
    replacedByTokenId: row.replaced_by_token_id,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class MySqlRefreshTokenRepository extends RefreshTokenRepositoryPort {
  #pool;

  constructor(pool = getMysqlPool()) {
    super();
    this.#pool = pool;
  }

  async create(entry, connection = this.#pool) {
    try {
      const [result] = await connection.query(
        `INSERT INTO refresh_tokens (user_id, family_id, token_hash, device_label, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          entry.userId,
          entry.familyId,
          entry.tokenHash,
          entry.deviceLabel ?? null,
          entry.expiresAt,
        ],
      );
      return await this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} FROM refresh_tokens WHERE id = ? LIMIT 1`,
      [id],
    );
    return toDomain(rows[0]);
  }

  async findByTokenHash(tokenHash, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
      [tokenHash],
    );
    return toDomain(rows[0]);
  }

  async revoke(id, replacedByTokenId = null, connection = this.#pool) {
    await connection.query(
      'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3), replaced_by_token_id = ? WHERE id = ?',
      [replacedByTokenId, id],
    );
  }

  async revokeFamily(familyId, connection = this.#pool) {
    await connection.query(
      'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE family_id = ? AND revoked_at IS NULL',
      [familyId],
    );
  }

  async revokeAllForUser(userId, connection = this.#pool) {
    const [result] = await connection.query(
      'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL',
      [userId],
    );
    return result.affectedRows;
  }
}

export default MySqlRefreshTokenRepository;
