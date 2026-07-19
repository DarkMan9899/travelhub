/**
 * PermissionResolver — domain service.
 *
 * Implements `API_SPECIFICATION.md` §6 point 2: "permissions themselves
 * are resolved from role IDs against a short-TTL cache... not embedded
 * directly [in the access token], so a permission change takes effect
 * within that cache's TTL rather than only at the token's next refresh."
 *
 * Depends only on the `PermissionRepository` port (`core` may depend
 * only on `core`, Ch.3's Dependency Rule) — same constructor-injection
 * pattern as `auditLogger.js`. Whether the injected repository is the
 * plain DB-backed one or the Redis-caching decorator is decided once, at
 * the composition root (`app.js`), never here.
 */

export class PermissionResolver {
  #repository;

  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * @param {string[]} roleCodes
   * @returns {Promise<Set<string>>} the distinct permission keys granted by any of these roles
   */
  async resolvePermissions(roleCodes) {
    if (!Array.isArray(roleCodes) || roleCodes.length === 0) return new Set();
    const keys =
      await this.#repository.getPermissionKeysForRoleCodes(roleCodes);
    return new Set(keys);
  }

  /**
   * @param {string[]} roleCodes
   * @param {string} permissionKey
   * @returns {Promise<boolean>}
   */
  async hasPermission(roleCodes, permissionKey) {
    const permissions = await this.resolvePermissions(roleCodes);
    return permissions.has(permissionKey);
  }
}

export default PermissionResolver;
