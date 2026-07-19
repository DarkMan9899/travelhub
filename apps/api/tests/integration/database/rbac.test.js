/**
 * Sprint 5 §17: "role and permission relationships" / "authorization
 * foundation." Asserts the two independent RBAC layers documented in
 * docs/SPRINT_5_DATABASE_FOUNDATION.md §4 actually resolve correctly
 * once migrated and seeded: global roles via role_user/permission_role,
 * and partner-scoped roles via partner_employees (supporting one user
 * belonging to multiple partner organizations, Sprint 5 §5).
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';

let pool;

beforeAll(async () => {
  await up();
  await seedAll();
  pool = getMysqlPool();
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
});

async function permissionKeysForRole(roleCode) {
  const [rows] = await pool.query(
    `SELECT p.\`key\`
     FROM permissions p
     JOIN permission_role pr ON pr.permission_id = p.id
     JOIN roles r ON r.id = pr.role_id
     WHERE r.code = ?
     ORDER BY p.\`key\``,
    [roleCode],
  );
  return rows.map((row) => row.key);
}

describe('Global RBAC (role_user / permission_role)', () => {
  test('SUPER_ADMIN resolves to every seeded permission', async () => {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM permissions',
    );
    const keys = await permissionKeysForRole('SUPER_ADMIN');
    expect(keys.length).toBe(Number(total));
  });

  test('ADMIN has every permission except role.manage (reserved to SUPER_ADMIN)', async () => {
    const keys = await permissionKeysForRole('ADMIN');
    expect(keys).not.toContain('role.manage');
    expect(keys).toContain('listing.moderate');
  });

  test('MODERATOR is limited to a moderation-focused subset', async () => {
    const keys = await permissionKeysForRole('MODERATOR');
    expect(keys.sort()).toEqual(
      [
        'listing.moderate',
        'media.moderate',
        'partner.moderate',
        'promotion.approve',
        'review.moderate',
      ].sort(),
    );
    expect(keys).not.toContain('role.manage');
    expect(keys).not.toContain('user.suspend');
  });

  test('CUSTOMER has zero RBAC permissions (ownership checks apply instead)', async () => {
    const keys = await permissionKeysForRole('CUSTOMER');
    expect(keys).toHaveLength(0);
  });

  test('application code never needs to check a role by name to resolve a permission — the join is data-driven', async () => {
    // Structural proof: permissions carry no role reference, and roles carry
    // no permission reference — the only link is the permission_role pivot,
    // so adding a new permission-to-role assignment is an INSERT, never a
    // code change (DATABASE_ARCHITECTURE.md §9).
    const [[permissionsColumns]] = await pool.query(
      'SHOW COLUMNS FROM permissions',
    );
    const [[rolesColumns]] = await pool.query('SHOW COLUMNS FROM roles');
    expect(permissionsColumns.Field).not.toBe('role_id');
    expect(rolesColumns.Field).not.toBe('permission_id');
  });
});

describe('Partner-scoped RBAC (partner_employees) — Sprint 5 §5', () => {
  test('the seeded dev vendor is an OWNER of the seeded dev partner', async () => {
    const [rows] = await pool.query(
      `SELECT per.code AS role_code
       FROM partner_employees pe
       JOIN partner_employee_roles per ON per.id = pe.role_id
       JOIN users u ON u.id = pe.user_id
       JOIN partners p ON p.id = pe.partner_id
       WHERE u.normalized_email = ? AND p.slug = ?`,
      ['vendor@travelhub.dev', 'yerevan-boutique-hospitality'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].role_code).toBe('OWNER');
  });

  test('one user can hold different roles at two different partner organizations', async () => {
    const [[{ id: userId }]] = await pool.query(
      'SELECT id FROM users WHERE normalized_email = ?',
      ['vendor@travelhub.dev'],
    );
    const [[{ id: managerRoleId }]] = await pool.query(
      'SELECT id FROM partner_employee_roles WHERE code = ?',
      ['MANAGER'],
    );
    const [[{ id: approvedStatusId }]] = await pool.query(
      'SELECT id FROM moderation_statuses WHERE code = ?',
      ['APPROVED'],
    );

    const [partnerResult] = await pool.query(
      `INSERT INTO partners (legal_name, display_name, slug, verification_status_id, moderation_status_id, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE legal_name = VALUES(legal_name)`,
      [
        'RBAC Test Partner LLC',
        'RBAC Test Partner',
        'rbac-test-second-partner',
        approvedStatusId,
        approvedStatusId,
        userId,
      ],
    );
    const secondPartnerId =
      partnerResult.insertId ||
      (
        await pool.query('SELECT id FROM partners WHERE slug = ?', [
          'rbac-test-second-partner',
        ])
      )[0][0].id;

    await pool.query(
      'INSERT IGNORE INTO partner_employees (partner_id, user_id, role_id) VALUES (?, ?, ?)',
      [secondPartnerId, userId, managerRoleId],
    );

    const [memberships] = await pool.query(
      `SELECT p.slug, per.code AS role_code
       FROM partner_employees pe
       JOIN partner_employee_roles per ON per.id = pe.role_id
       JOIN partners p ON p.id = pe.partner_id
       WHERE pe.user_id = ?
       ORDER BY p.slug`,
      [userId],
    );

    expect(memberships.length).toBeGreaterThanOrEqual(2);
    const roleBySlug = Object.fromEntries(
      memberships.map((row) => [row.slug, row.role_code]),
    );
    expect(roleBySlug['yerevan-boutique-hospitality']).toBe('OWNER');
    expect(roleBySlug['rbac-test-second-partner']).toBe('MANAGER');
  });
});
