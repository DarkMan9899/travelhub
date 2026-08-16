/**
 * MySQL-backed Settings repository — Stage 11.9 Admin Platform.
 *
 * Owns `system_settings` (generic key/JSON-value store) and
 * `feature_flags` (named boolean toggles) — new tables with no existing
 * owning module, so this lives in the cross-cutting `admin` module, same
 * placement reasoning as `mysqlMarketplaceConfigRepository.js`'s header
 * comment. `value`/`before`/`after` JSON columns are written via
 * `JSON.stringify` and read back already parsed by mysql2's default JSON
 * type-casting — the same convention `auditLogRepository.js` established.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';

function toSettingDomain(row) {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function toFeatureFlagDomain(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isEnabled: Boolean(row.is_enabled),
    updatedAt: row.updated_at,
  };
}

export class MySqlSettingsRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async #run(sql, params) {
    try {
      return await this.#pool.query(sql, params);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  // ---------------------------------------------------------------
  // System settings
  // ---------------------------------------------------------------

  async listSettings() {
    const [rows] = await this.#run(
      'SELECT id, `key`, value, description, updated_by, updated_at FROM system_settings ORDER BY `key` ASC',
    );
    return rows.map(toSettingDomain);
  }

  async findSettingById(id) {
    const [rows] = await this.#run(
      'SELECT id, `key`, value, description, updated_by, updated_at FROM system_settings WHERE id = ?',
      [id],
    );
    return rows[0] ? toSettingDomain(rows[0]) : null;
  }

  async createSetting({ key, value, description }, updatedBy) {
    const [result] = await this.#run(
      'INSERT INTO system_settings (`key`, value, description, updated_by) VALUES (?, ?, ?, ?)',
      [key, JSON.stringify(value), description ?? null, updatedBy],
    );
    return this.findSettingById(result.insertId);
  }

  async updateSetting(id, { key, value, description }, updatedBy) {
    await this.#run(
      'UPDATE system_settings SET `key` = ?, value = ?, description = ?, updated_by = ? WHERE id = ?',
      [key, JSON.stringify(value), description ?? null, updatedBy, id],
    );
    return this.findSettingById(id);
  }

  async deleteSetting(id) {
    await this.#run('DELETE FROM system_settings WHERE id = ?', [id]);
  }

  // ---------------------------------------------------------------
  // Feature flags
  // ---------------------------------------------------------------

  async listFeatureFlags() {
    const [rows] = await this.#run(
      'SELECT id, code, name, description, is_enabled, updated_at FROM feature_flags ORDER BY code ASC',
    );
    return rows.map(toFeatureFlagDomain);
  }

  async findFeatureFlagById(id) {
    const [rows] = await this.#run(
      'SELECT id, code, name, description, is_enabled, updated_at FROM feature_flags WHERE id = ?',
      [id],
    );
    return rows[0] ? toFeatureFlagDomain(rows[0]) : null;
  }

  async createFeatureFlag({ code, name, description, isEnabled }) {
    const [result] = await this.#run(
      'INSERT INTO feature_flags (code, name, description, is_enabled) VALUES (?, ?, ?, ?)',
      [code, name, description ?? null, isEnabled ? 1 : 0],
    );
    return this.findFeatureFlagById(result.insertId);
  }

  async updateFeatureFlag(id, { code, name, description, isEnabled }) {
    await this.#run(
      'UPDATE feature_flags SET code = ?, name = ?, description = ?, is_enabled = ? WHERE id = ?',
      [code, name, description ?? null, isEnabled ? 1 : 0, id],
    );
    return this.findFeatureFlagById(id);
  }

  async deleteFeatureFlag(id) {
    await this.#run('DELETE FROM feature_flags WHERE id = ?', [id]);
  }
}

export default MySqlSettingsRepository;
