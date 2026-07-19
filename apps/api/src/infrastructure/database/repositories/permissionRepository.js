/**
 * MySQL implementation of the PermissionRepository port.
 *
 * Shared/cross-module, like `auditLogRepository.js` — permission
 * resolution is used by every module's `requirePermission` guard, not
 * owned by any single feature module, so it lives under `infrastructure/`
 * rather than inside `modules/auth/` or `modules/users/`.
 */

import { getMysqlPool } from '../mysqlPool.js';
import { PermissionRepository as PermissionRepositoryPort } from '../../../core/interfaces/PermissionRepository.js';

export class MySqlPermissionRepository extends PermissionRepositoryPort {
  #pool;

  constructor(pool = getMysqlPool()) {
    super();
    this.#pool = pool;
  }

  async getPermissionKeysForRoleCodes(roleCodes) {
    if (roleCodes.length === 0) return [];
    const placeholders = roleCodes.map(() => '?').join(', ');
    const [rows] = await this.#pool.query(
      `SELECT DISTINCT p.\`key\` AS \`key\`
       FROM permissions p
       JOIN permission_role pr ON pr.permission_id = p.id
       JOIN roles r ON r.id = pr.role_id
       WHERE r.code IN (${placeholders})`,
      roleCodes,
    );
    return rows.map((row) => row.key);
  }
}

export default MySqlPermissionRepository;
