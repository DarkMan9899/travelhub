/**
 * AuditLogService — Stage 11.7 Admin Platform.
 *
 * View-only: a thin permission gate in front of
 * `MySqlAuditLogRepository.list()` (the audit trail's first read path —
 * every other admin service writes to it via `AuditLogger`, never reads
 * from it). No mutation methods exist here by design; audit-log rows are
 * never editable or deletable through the API.
 *
 * `audit.view` is already seeded for SUPER_ADMIN/ADMIN/SUPPORT
 * (`004_roles_and_permissions.js`) — MODERATOR does not have it, so a
 * moderator can reach every other admin-area page but not this one,
 * matching that seed's existing "read-only admin-area access" scoping
 * for SUPPORT rather than widening MODERATOR's grants.
 */

import { AuthorizationError } from '../../../errors/AppError.js';

const VIEW_PERMISSION = 'audit.view';

export class AuditLogService {
  #repository;

  #permissionResolver;

  constructor({ repository, permissionResolver }) {
    this.#repository = repository;
    this.#permissionResolver = permissionResolver;
  }

  async #assertCanView(principal) {
    const granted = await this.#permissionResolver.hasPermission(
      principal.roles,
      VIEW_PERMISSION,
    );
    if (!granted) throw new AuthorizationError();
  }

  async list(principal, filters) {
    await this.#assertCanView(principal);
    return this.#repository.list(filters);
  }
}

export default AuditLogService;
