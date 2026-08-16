/**
 * Partner-employee lookups backing the "Host" authorization mapping
 * (Sprint 6 decision: Sprint 6's "Host" role maps onto the existing
 * `partner_employees` + `partner_employee_roles.OWNER` capability from
 * Sprint 5 — the documented RBAC model protects exactly seven seeded
 * roles, none named "Host"). A single function rather than a full
 * port/adapter pair: it has one caller (`src/guards/requireHost.js`) and
 * one narrow query — a formal port is worth adding once a real module
 * needs broader partner-employee access.
 */

import { getMysqlPool } from '../mysqlPool.js';

/**
 * @param {number} userId
 * @param {number|null} [partnerId] - scope to one partner, or null to
 *   check "is this user an OWNER of any partner"
 * @param {import('mysql2/promise').Pool} [pool]
 * @returns {Promise<boolean>}
 */
export async function isPartnerOwner(
  userId,
  partnerId = null,
  pool = getMysqlPool(),
) {
  const conditions = [
    'pe.user_id = ?',
    'pe.deleted_at IS NULL',
    "per.code = 'OWNER'",
  ];
  const params = [userId];

  if (partnerId !== null) {
    conditions.push('pe.partner_id = ?');
    params.push(partnerId);
  }

  const [rows] = await pool.query(
    `SELECT pe.id
     FROM partner_employees pe
     JOIN partner_employee_roles per ON per.id = pe.role_id
     WHERE ${conditions.join(' AND ')}
     LIMIT 1`,
    params,
  );

  return rows.length > 0;
}

/**
 * The caller's `partner_employee_roles.code` for one partner (`OWNER`,
 * `MANAGER`, `EDITOR`, `BOOKING_MANAGER`, `ANALYTICS_VIEWER`), or `null`
 * if they aren't an active employee of that partner at all — feeds
 * `core/domain/partnerCapabilities.js#roleHasCapability` (Phase 17 §14).
 *
 * @param {number} userId
 * @param {number} partnerId
 * @param {import('mysql2/promise').Pool} [pool]
 * @returns {Promise<string|null>}
 */
export async function getPartnerEmployeeRoleCode(
  userId,
  partnerId,
  pool = getMysqlPool(),
) {
  const [rows] = await pool.query(
    `SELECT per.code
     FROM partner_employees pe
     JOIN partner_employee_roles per ON per.id = pe.role_id
     WHERE pe.user_id = ? AND pe.partner_id = ? AND pe.deleted_at IS NULL
     LIMIT 1`,
    [userId, partnerId],
  );
  return rows[0]?.code ?? null;
}

export default isPartnerOwner;
