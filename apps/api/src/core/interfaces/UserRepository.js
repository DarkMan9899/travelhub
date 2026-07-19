/**
 * UserRepository port.
 *
 * Domain-layer interface (BACKEND_ARCHITECTURE.md §7), implemented
 * concretely by `src/modules/users/repositories/mysqlUserRepository.js`.
 * The Users module owns the `users` table (Module Catalog #3) — every
 * other module (Auth included) depends on `UserService`'s public
 * interface, never this repository directly (Ch.4's cross-module rule).
 *
 * @typedef {object} UserRecord
 * @property {number} id
 * @property {string} email
 * @property {string} normalizedEmail
 * @property {string|null} phone
 * @property {string} passwordHash
 * @property {string} firstName
 * @property {string} lastName
 * @property {number|null} avatarMediaId
 * @property {number|null} preferredLanguageId
 * @property {number|null} preferredCurrencyId
 * @property {number} statusId
 * @property {boolean} isEmailVerified
 */

/* eslint-disable class-methods-use-this, no-unused-vars */
export class UserRepository {
  /** @param {object} data @returns {Promise<UserRecord>} */
  async create(data) {
    throw new Error(
      'UserRepository.create must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} id @returns {Promise<UserRecord|null>} */
  async findById(id) {
    throw new Error(
      'UserRepository.findById must be implemented by a concrete adapter.',
    );
  }

  /** @param {string} normalizedEmail @returns {Promise<UserRecord|null>} */
  async findByNormalizedEmail(normalizedEmail) {
    throw new Error(
      'UserRepository.findByNormalizedEmail must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} id @param {object} fields @returns {Promise<UserRecord>} */
  async updateProfile(id, fields) {
    throw new Error(
      'UserRepository.updateProfile must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} id @param {string} passwordHash @returns {Promise<void>} */
  async updatePasswordHash(id, passwordHash) {
    throw new Error(
      'UserRepository.updatePasswordHash must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} id @param {number} avatarMediaId @returns {Promise<void>} */
  async updateAvatarMediaId(id, avatarMediaId) {
    throw new Error(
      'UserRepository.updateAvatarMediaId must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} id @returns {Promise<void>} */
  async updateLastLoginAt(id) {
    throw new Error(
      'UserRepository.updateLastLoginAt must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} userId @returns {Promise<string[]>} global role codes, e.g. ['CUSTOMER'] */
  async getRoleCodes(userId) {
    throw new Error(
      'UserRepository.getRoleCodes must be implemented by a concrete adapter.',
    );
  }

  /** @param {number} userId @param {string} roleCode @returns {Promise<void>} */
  async assignRole(userId, roleCode) {
    throw new Error(
      'UserRepository.assignRole must be implemented by a concrete adapter.',
    );
  }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default UserRepository;
