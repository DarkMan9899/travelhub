/**
 * MySQL-backed repository for partner staff membership and invitations
 * (P1.4, Master Roadmap) — kept separate from `mysqlPartnerRepository.js`
 * (already large, and scoped to the `partners` table itself) since this
 * is a genuinely distinct sub-resource with its own two tables
 * (`partner_employees`, `partner_employee_invitations`).
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';

function toStaffMemberDomain(row) {
  return {
    id: row.id,
    partnerId: row.partner_id,
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    roleId: row.role_id,
    roleCode: row.role_code,
    roleName: row.role_name,
    since: row.created_at,
  };
}

function toInvitationDomain(row) {
  return {
    id: row.id,
    partnerId: row.partner_id,
    email: row.email,
    roleId: row.role_id,
    roleCode: row.role_code,
    roleName: row.role_name,
    invitedByUserId: row.invited_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

const STAFF_SELECT = `
  SELECT pe.id, pe.partner_id, pe.user_id, u.email, u.first_name, u.last_name,
         pe.role_id, per.code AS role_code, per.name AS role_name, pe.created_at
  FROM partner_employees pe
  JOIN users u ON u.id = pe.user_id
  JOIN partner_employee_roles per ON per.id = pe.role_id
`;

const INVITATION_SELECT = `
  SELECT pei.id, pei.partner_id, pei.email, pei.role_id, per.code AS role_code,
         per.name AS role_name, pei.invited_by, pei.expires_at, pei.accepted_at,
         pei.revoked_at, pei.created_at
  FROM partner_employee_invitations pei
  JOIN partner_employee_roles per ON per.id = pei.role_id
`;

export class MySqlPartnerStaffRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  /** Every active (non-removed) `partner_employees` row for one partner, oldest first. */
  async listActiveStaff(partnerId, connection = this.#pool) {
    const [rows] = await connection.query(
      `${STAFF_SELECT} WHERE pe.partner_id = ? AND pe.deleted_at IS NULL ORDER BY pe.id ASC`,
      [partnerId],
    );
    return rows.map(toStaffMemberDomain);
  }

  /** One active staff row, scoped to the given partner (never leaks a match belonging to a different partner). */
  async findActiveStaffById(partnerId, employeeId, connection = this.#pool) {
    const [rows] = await connection.query(
      `${STAFF_SELECT} WHERE pe.id = ? AND pe.partner_id = ? AND pe.deleted_at IS NULL LIMIT 1`,
      [employeeId, partnerId],
    );
    return rows[0] ? toStaffMemberDomain(rows[0]) : null;
  }

  async updateStaffRole(
    employeeId,
    roleId,
    updatedByUserId,
    connection = this.#pool,
  ) {
    await connection.query(
      'UPDATE partner_employees SET role_id = ?, updated_by = ? WHERE id = ?',
      [roleId, updatedByUserId, employeeId],
    );
  }

  async removeStaff(employeeId, removedByUserId, connection = this.#pool) {
    await connection.query(
      `UPDATE partner_employees
       SET deleted_at = CURRENT_TIMESTAMP(3), deleted_by = ?, updated_by = ?
       WHERE id = ?`,
      [removedByUserId, removedByUserId, employeeId],
    );
  }

  /** Used at invite-acceptance time to insert the new membership row. */
  async insertStaff(
    { partnerId, userId, roleId, createdByUserId },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO partner_employees (partner_id, user_id, role_id, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?)`,
        [partnerId, userId, roleId, createdByUserId, createdByUserId],
      );
      return this.findActiveStaffById(partnerId, result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  /** Every still-PENDING (unaccepted, unrevoked, not necessarily unexpired) invitation for one partner. */
  async listPendingInvitations(partnerId, connection = this.#pool) {
    const [rows] = await connection.query(
      `${INVITATION_SELECT}
       WHERE pei.partner_id = ? AND pei.accepted_at IS NULL AND pei.revoked_at IS NULL
       ORDER BY pei.id DESC`,
      [partnerId],
    );
    return rows.map(toInvitationDomain);
  }

  async findPendingInvitationById(
    partnerId,
    invitationId,
    connection = this.#pool,
  ) {
    const [rows] = await connection.query(
      `${INVITATION_SELECT}
       WHERE pei.id = ? AND pei.partner_id = ? AND pei.accepted_at IS NULL AND pei.revoked_at IS NULL
       LIMIT 1`,
      [invitationId, partnerId],
    );
    return rows[0] ? toInvitationDomain(rows[0]) : null;
  }

  /**
   * Looked up by the SHA-256 hash of the raw token a caller presents —
   * the raw token itself is never stored (same idiom as
   * `refresh_tokens.token_hash`). Returns a still-pending invitation
   * regardless of whether it has expired — the Service decides what an
   * expired-but-not-yet-revoked invitation means, this is just the read.
   */
  async findPendingInvitationByTokenHash(tokenHash, connection = this.#pool) {
    const [rows] = await connection.query(
      `${INVITATION_SELECT}
       WHERE pei.token_hash = ? AND pei.accepted_at IS NULL AND pei.revoked_at IS NULL
       LIMIT 1`,
      [tokenHash],
    );
    return rows[0] ? toInvitationDomain(rows[0]) : null;
  }

  /**
   * Any existing PENDING invitation to this exact partner+email is
   * revoked first (a "resend" simply supersedes the old link) so the
   * new INSERT never trips `uq_partner_employee_invitations_pending`.
   */
  async revokeAllPendingForEmail(
    partnerId,
    normalizedEmail,
    connection = this.#pool,
  ) {
    await connection.query(
      `UPDATE partner_employee_invitations
       SET revoked_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
       WHERE partner_id = ? AND normalized_email = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
      [partnerId, normalizedEmail],
    );
  }

  async createInvitation(
    {
      partnerId,
      email,
      normalizedEmail,
      roleId,
      tokenHash,
      invitedByUserId,
      expiresAt,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO partner_employee_invitations
          (partner_id, email, normalized_email, role_id, token_hash, invited_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          partnerId,
          email,
          normalizedEmail,
          roleId,
          tokenHash,
          invitedByUserId,
          expiresAt,
        ],
      );
      const [rows] = await connection.query(
        `${INVITATION_SELECT} WHERE pei.id = ? LIMIT 1`,
        [result.insertId],
      );
      return toInvitationDomain(rows[0]);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async revokeInvitation(invitationId, connection = this.#pool) {
    await connection.query(
      `UPDATE partner_employee_invitations
       SET revoked_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [invitationId],
    );
  }

  async markInvitationAccepted(
    invitationId,
    acceptedByUserId,
    connection = this.#pool,
  ) {
    await connection.query(
      `UPDATE partner_employee_invitations
       SET accepted_at = CURRENT_TIMESTAMP(3), accepted_by = ?, updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [acceptedByUserId, invitationId],
    );
  }

  /** @returns {Promise<number|null>} the role's id, or null if `code` isn't a real `partner_employee_roles.code`. */
  async findRoleIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM partner_employee_roles WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }
}

export default MySqlPartnerStaffRepository;
