/**
 * SettingsService — Stage 11.9 Admin Platform.
 *
 * Admin CRUD for `system_settings` (generic key/JSON-value store) and
 * `feature_flags` (named boolean toggles) — the platform's control
 * plane, not new flag-gated behavior: no consuming code checks a flag's
 * `isEnabled` value yet anywhere else in this codebase, a deliberate,
 * documented scope boundary for this stage.
 *
 * Every mutation requires `settings.manage` (already seeded, granted to
 * ADMIN/SUPER_ADMIN) and is audit-logged; every read only requires the
 * admin-area role `module.routes.js`'s `requireRole` already enforces —
 * same "view without the permission to mutate" convention
 * `marketplaceConfigService.js` established.
 */

import { NotFoundError, AuthorizationError } from '../../../errors/AppError.js';

const MANAGE_PERMISSION = 'settings.manage';

export class SettingsService {
  #repository;

  #permissionResolver;

  #auditLogger;

  constructor({ repository, permissionResolver, auditLogger }) {
    this.#repository = repository;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
  }

  async #assertCanManage(principal) {
    const granted = await this.#permissionResolver.hasPermission(
      principal.roles,
      MANAGE_PERMISSION,
    );
    if (!granted) throw new AuthorizationError();
  }

  async #audit(principal, action, targetType, targetId, before, after) {
    await this.#auditLogger.record({
      actorId: principal.userId,
      action,
      targetType,
      targetId,
      beforeSnapshot: before,
      afterSnapshot: after,
    });
  }

  // ---------------------------------------------------------------
  // System settings
  // ---------------------------------------------------------------

  async listSettings() {
    return this.#repository.listSettings();
  }

  async createSetting(principal, input) {
    await this.#assertCanManage(principal);
    const created = await this.#repository.createSetting(
      input,
      principal.userId,
    );
    await this.#audit(
      principal,
      'settings.setting_created',
      'system_setting',
      created.id,
      null,
      created,
    );
    return created;
  }

  async updateSetting(principal, id, input) {
    await this.#assertCanManage(principal);
    const before = await this.#repository.findSettingById(id);
    if (!before) throw new NotFoundError('Setting not found.');
    const updated = await this.#repository.updateSetting(
      id,
      input,
      principal.userId,
    );
    await this.#audit(
      principal,
      'settings.setting_updated',
      'system_setting',
      id,
      before,
      updated,
    );
    return updated;
  }

  async deleteSetting(principal, id) {
    await this.#assertCanManage(principal);
    const before = await this.#repository.findSettingById(id);
    if (!before) throw new NotFoundError('Setting not found.');
    await this.#repository.deleteSetting(id);
    await this.#audit(
      principal,
      'settings.setting_deleted',
      'system_setting',
      id,
      before,
      null,
    );
  }

  // ---------------------------------------------------------------
  // Feature flags
  // ---------------------------------------------------------------

  async listFeatureFlags() {
    return this.#repository.listFeatureFlags();
  }

  async createFeatureFlag(principal, input) {
    await this.#assertCanManage(principal);
    const created = await this.#repository.createFeatureFlag(input);
    await this.#audit(
      principal,
      'settings.feature_flag_created',
      'feature_flag',
      created.id,
      null,
      created,
    );
    return created;
  }

  async updateFeatureFlag(principal, id, input) {
    await this.#assertCanManage(principal);
    const before = await this.#repository.findFeatureFlagById(id);
    if (!before) throw new NotFoundError('Feature flag not found.');
    const updated = await this.#repository.updateFeatureFlag(id, input);
    await this.#audit(
      principal,
      'settings.feature_flag_updated',
      'feature_flag',
      id,
      before,
      updated,
    );
    return updated;
  }

  async deleteFeatureFlag(principal, id) {
    await this.#assertCanManage(principal);
    const before = await this.#repository.findFeatureFlagById(id);
    if (!before) throw new NotFoundError('Feature flag not found.');
    await this.#repository.deleteFeatureFlag(id);
    await this.#audit(
      principal,
      'settings.feature_flag_deleted',
      'feature_flag',
      id,
      before,
      null,
    );
  }
}

export default SettingsService;
