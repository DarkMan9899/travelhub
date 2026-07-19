/**
 * RefreshTokenRepository port.
 *
 * Domain-layer interface implemented by
 * `src/modules/auth/repositories/mysqlRefreshTokenRepository.js`. Backs
 * `API_SPECIFICATION.md` §7's rotation/reuse-detection/logout-all
 * mechanics (migration 0012's `refresh_tokens` table).
 *
 * @typedef {object} RefreshTokenRecord
 * @property {number} id
 * @property {number} userId
 * @property {string} familyId
 * @property {string} tokenHash
 * @property {string|null} deviceLabel
 * @property {number|null} replacedByTokenId
 * @property {Date|null} revokedAt
 * @property {Date} expiresAt
 */

/* eslint-disable class-methods-use-this, no-unused-vars */
export class RefreshTokenRepository {
  /** @param {object} entry @returns {Promise<RefreshTokenRecord>} */
  async create(entry) {
    throw new Error(
      'RefreshTokenRepository.create must be implemented by a concrete adapter.',
    );
  }

  /** @param {string} tokenHash @returns {Promise<RefreshTokenRecord|null>} */
  async findByTokenHash(tokenHash) {
    throw new Error(
      'RefreshTokenRepository.findByTokenHash must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} id @param {number|null} replacedByTokenId @returns {Promise<void>} */
  async revoke(id, replacedByTokenId = null) {
    throw new Error(
      'RefreshTokenRepository.revoke must be implemented by a concrete adapter.',
    );
  }

  /** @param {string} familyId @returns {Promise<void>} */
  async revokeFamily(familyId) {
    throw new Error(
      'RefreshTokenRepository.revokeFamily must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} userId @returns {Promise<number>} count of tokens revoked */
  async revokeAllForUser(userId) {
    throw new Error(
      'RefreshTokenRepository.revokeAllForUser must be implemented by a concrete adapter.',
    );
  }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default RefreshTokenRepository;
