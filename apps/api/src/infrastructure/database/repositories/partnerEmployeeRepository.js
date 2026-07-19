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

export default isPartnerOwner;
