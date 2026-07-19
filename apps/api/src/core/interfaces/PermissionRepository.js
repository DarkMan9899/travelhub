/**
 * PermissionRepository port.
 *
 * Domain-layer interface implemented concretely by
 * `src/infrastructure/database/repositories/permissionRepository.js`
 * (DB-backed) and decorated by
 * `src/infrastructure/cache/cachedPermissionRepository.js` (Redis,
 * `API_SPECIFICATION.md` §18's 60-second TTL) — both satisfy this same
 * port, so `src/core/domain/permissionResolver.js` never knows caching
 * exists.
 */

/* eslint-disable class-methods-use-this, no-unused-vars */
export class PermissionRepository {
  /**
   * @param {string[]} roleCodes - e.g. ['CUSTOMER', 'ADMIN']
   * @returns {Promise<string[]>} distinct permission keys, e.g. ['listing.publish']
   */
  async getPermissionKeysForRoleCodes(roleCodes) {
    throw new Error(
      'PermissionRepository.getPermissionKeysForRoleCodes must be implemented by a concrete adapter.',
    );
  }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default PermissionRepository;
