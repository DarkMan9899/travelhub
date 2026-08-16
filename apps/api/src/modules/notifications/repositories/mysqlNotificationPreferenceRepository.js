/**
 * MySQL-backed Notification preference repository — Phase 13.
 *
 * Absence of a row for a (user, category) pair means both channels are
 * enabled by default (Scope decision #7 — no backfill needed for
 * existing users); `NotificationPreferenceService` is what applies that
 * default, this repository only ever returns what's actually stored.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';

function toPreferenceDomain(row) {
  return {
    categoryCode: row.category_code,
    inAppEnabled: Boolean(row.in_app_enabled),
    emailEnabled: Boolean(row.email_enabled),
  };
}

export class MySqlNotificationPreferenceRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  /** Every seeded category code — the service layer merges default-enabled for any code with no override row. */
  async listCategoryCodes() {
    const [rows] = await this.#pool.query(
      'SELECT code FROM notification_categories ORDER BY id',
    );
    return rows.map((row) => row.code);
  }

  /** Only the categories with an explicit override — service layer merges defaults for the rest. */
  async listForUser(userId) {
    const [rows] = await this.#pool.query(
      `SELECT nc.code AS category_code, np.in_app_enabled, np.email_enabled
       FROM notification_preferences np
       JOIN notification_categories nc ON nc.id = np.category_id
       WHERE np.user_id = ?`,
      [userId],
    );
    return rows.map(toPreferenceDomain);
  }

  async findForUserAndCategory(userId, categoryCode) {
    const [rows] = await this.#pool.query(
      `SELECT nc.code AS category_code, np.in_app_enabled, np.email_enabled
       FROM notification_preferences np
       JOIN notification_categories nc ON nc.id = np.category_id
       WHERE np.user_id = ? AND nc.code = ?
       LIMIT 1`,
      [userId, categoryCode],
    );
    return rows[0] ? toPreferenceDomain(rows[0]) : null;
  }

  async upsert(userId, categoryCode, { inAppEnabled, emailEnabled }) {
    await this.#pool.query(
      `INSERT INTO notification_preferences (user_id, category_id, in_app_enabled, email_enabled)
       VALUES (?, (SELECT id FROM notification_categories WHERE code = ?), ?, ?)
       ON DUPLICATE KEY UPDATE
         in_app_enabled = VALUES(in_app_enabled),
         email_enabled = VALUES(email_enabled)`,
      [userId, categoryCode, inAppEnabled ? 1 : 0, emailEnabled ? 1 : 0],
    );
    return this.findForUserAndCategory(userId, categoryCode);
  }
}

export default MySqlNotificationPreferenceRepository;
