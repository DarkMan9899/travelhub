/**
 * MySQL implementation of the UserRepository port.
 *
 * Owns the `users` table (Module Catalog #3) — this is the only
 * Repository any module may use to read/write `users`; other modules
 * (Auth included) go through `UserService`'s public interface instead
 * (BACKEND_ARCHITECTURE.md §4's cross-module rule). Also owns the
 * narrow avatar-media persistence for `POST /users/:id/avatar` (Sprint 6
 * §5 "storage abstraction only") — a full Media module doesn't exist
 * yet, so this stays scoped to exactly what avatars need rather than
 * standing up a general-purpose media Repository ahead of that module.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import { scopeActive } from '../../../infrastructure/database/softDelete.js';
import { UserRepository as UserRepositoryPort } from '../../../core/interfaces/UserRepository.js';

const SELECT_COLUMNS = `
  u.id, u.email, u.normalized_email, u.phone, u.password_hash, u.first_name, u.last_name,
  u.avatar_media_id, u.preferred_language_id, u.preferred_currency_id, u.status_id, us.code AS status_code,
  u.is_email_verified, u.is_phone_verified, u.last_login_at, u.created_at, u.updated_at, u.deleted_at
`;
const FROM_USERS_JOINED =
  'FROM users u JOIN user_statuses us ON us.id = u.status_id';

const PROFILE_FIELD_TO_COLUMN = Object.freeze({
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  preferredLanguageId: 'preferred_language_id',
  preferredCurrencyId: 'preferred_currency_id',
});

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalized_email,
    phone: row.phone,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarMediaId: row.avatar_media_id,
    preferredLanguageId: row.preferred_language_id,
    preferredCurrencyId: row.preferred_currency_id,
    statusId: row.status_id,
    statusCode: row.status_code,
    isEmailVerified: Boolean(row.is_email_verified),
    isPhoneVerified: Boolean(row.is_phone_verified),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class MySqlUserRepository extends UserRepositoryPort {
  #pool;

  constructor(pool = getMysqlPool()) {
    super();
    this.#pool = pool;
  }

  /**
   * `statusId` is never a caller-supplied param — every new account
   * starts `ACTIVE` (resolved via subquery; Sprint 6's register flow has
   * no separate "unverified" account *status*, see
   * docs/SPRINT_6_AUTH_FOUNDATION.md's Architecture Decisions — only the
   * pre-existing `is_email_verified` flag distinguishes that).
   */
  async create(data, connection = this.#pool) {
    try {
      const [result] = await connection.query(
        `INSERT INTO users
          (email, normalized_email, password_hash, first_name, last_name, phone, status_id, preferred_language_id, preferred_currency_id)
         VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM user_statuses WHERE code = 'ACTIVE'), ?, ?)`,
        [
          data.email,
          data.normalizedEmail,
          data.passwordHash,
          data.firstName,
          data.lastName,
          data.phone ?? null,
          data.preferredLanguageId ?? null,
          data.preferredCurrencyId ?? null,
        ],
      );
      return await this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_USERS_JOINED} WHERE u.id = ? AND ${scopeActive('u')} LIMIT 1`,
      [id],
    );
    return toDomain(rows[0]);
  }

  async findByNormalizedEmail(normalizedEmail, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_USERS_JOINED} WHERE u.normalized_email = ? AND ${scopeActive('u')} LIMIT 1`,
      [normalizedEmail],
    );
    return toDomain(rows[0]);
  }

  async updateProfile(id, fields, connection = this.#pool) {
    const assignments = [];
    const values = [];

    Object.entries(fields).forEach(([key, value]) => {
      const column = PROFILE_FIELD_TO_COLUMN[key];
      if (column && value !== undefined) {
        assignments.push(`${column} = ?`);
        values.push(value);
      }
    });

    if (assignments.length > 0) {
      try {
        await connection.query(
          `UPDATE users SET ${assignments.join(', ')} WHERE id = ?`,
          [...values, id],
        );
      } catch (err) {
        throw mapMysqlError(err);
      }
    }

    return this.findById(id, connection);
  }

  async updatePasswordHash(id, passwordHash, connection = this.#pool) {
    await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      id,
    ]);
  }

  async updateAvatarMediaId(id, avatarMediaId, connection = this.#pool) {
    await connection.query(
      'UPDATE users SET avatar_media_id = ? WHERE id = ?',
      [avatarMediaId, id],
    );
  }

  async updateLastLoginAt(id, connection = this.#pool) {
    await connection.query(
      'UPDATE users SET last_login_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [id],
    );
  }

  /** @returns {Promise<string[]>} the user's global role codes, e.g. ['CUSTOMER'] */
  async getRoleCodes(userId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT r.code FROM roles r JOIN role_user ru ON ru.role_id = r.id WHERE ru.user_id = ?`,
      [userId],
    );
    return rows.map((row) => row.code);
  }

  /**
   * Assigns a global role to a user (used by AuthenticationService.register
   * to grant the default CUSTOMER role — see Sprint 6's Architecture
   * Decisions on global vs. partner-scoped roles).
   */
  async assignRole(userId, roleCode, connection = this.#pool) {
    await connection.query(
      `INSERT IGNORE INTO role_user (role_id, user_id)
       SELECT id, ? FROM roles WHERE code = ?`,
      [userId, roleCode],
    );
  }

  /**
   * Inserts the `media` row backing an avatar upload and returns its id.
   * Avatars are auto-approved (unlike public listing photos, which
   * require moderation) — a personal profile photo is low fraud-risk
   * context; this is a deliberate, documented simplification for the
   * "storage abstraction only" scope of Sprint 6's avatar endpoint.
   */
  async createAvatarMedia(
    { userId, url, mimeType, fileSizeBytes },
    connection = this.#pool,
  ) {
    const [[imageType]] = await connection.query(
      "SELECT id FROM media_types WHERE code = 'IMAGE'",
    );
    const [[completedStatus]] = await connection.query(
      "SELECT id FROM media_upload_statuses WHERE code = 'COMPLETED'",
    );
    const [[approvedStatus]] = await connection.query(
      "SELECT id FROM moderation_statuses WHERE code = 'APPROVED'",
    );

    const [result] = await connection.query(
      `INSERT INTO media
        (mediable_type, mediable_id, media_type_id, url, upload_status_id, moderation_status_id, mime_type, file_size_bytes, owner_user_id, is_cover)
       VALUES ('user', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        userId,
        imageType.id,
        url,
        completedStatus.id,
        approvedStatus.id,
        mimeType,
        fileSizeBytes,
        userId,
      ],
    );
    return result.insertId;
  }
}

export default MySqlUserRepository;
