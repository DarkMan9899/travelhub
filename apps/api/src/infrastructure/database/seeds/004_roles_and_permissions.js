/**
 * Seeds global roles and a representative permission catalog (Sprint 5
 * §4): "The authorization model must be extensible and must not depend
 * only on hard-coded role checks" — every permission below is a data
 * row, attached to roles via permission_role, matching
 * DATABASE_ARCHITECTURE.md §9's "permissions are... attached to roles...
 * never checked by role name directly in application code" rule.
 *
 * Only global roles live here (CUSTOMER/MODERATOR/ADMIN/SUPER_ADMIN,
 * matching DATABASE_ARCHITECTURE.md §9's documented global set) —
 * partner-scoped roles (Sprint 5's VENDOR_OWNER/VENDOR_STAFF, mapped onto
 * `partner_employee_roles`) are seeded in 001_lookups.js and assigned
 * per-partner via `partner_employees`, never via this table. CUSTOMER
 * intentionally has zero permission_role rows — a customer's access to
 * their own bookings/reviews/favorites is an ownership check
 * (BACKEND_ARCHITECTURE.md §13), not an RBAC permission.
 */

import { upsertByCode, getIdsByCode } from './helpers.js';

const ROLES = [
  { code: 'CUSTOMER', name: 'Customer' },
  { code: 'MODERATOR', name: 'Moderator' },
  { code: 'ADMIN', name: 'Admin' },
  { code: 'SUPER_ADMIN', name: 'Super Admin' },
];

const PERMISSIONS = [
  {
    key: 'listing.create',
    module: 'listings',
    description: 'Create a listing',
  },
  {
    key: 'listing.update',
    module: 'listings',
    description: 'Update a listing',
  },
  {
    key: 'listing.delete',
    module: 'listings',
    description: 'Delete a listing',
  },
  {
    key: 'listing.publish',
    module: 'listings',
    description: 'Publish a listing',
  },
  {
    key: 'listing.moderate',
    module: 'listings',
    description: 'Approve or reject a listing',
  },
  {
    key: 'booking.view_all',
    module: 'bookings',
    description: 'View any booking, not only owned bookings',
  },
  {
    key: 'booking.confirm',
    module: 'bookings',
    description: "Confirm a customer's booking request",
  },
  {
    key: 'booking.reject',
    module: 'bookings',
    description: "Reject a customer's booking request",
  },
  {
    key: 'booking.cancel_any',
    module: 'bookings',
    description: 'Cancel any booking',
  },
  {
    key: 'partner.verify',
    module: 'partners',
    description: 'Approve or reject partner verification',
  },
  {
    key: 'partner.moderate',
    module: 'partners',
    description: 'Suspend or moderate a partner account',
  },
  {
    key: 'review.moderate',
    module: 'reviews',
    description: 'Approve, reject, or flag a review',
  },
  {
    key: 'media.moderate',
    module: 'media',
    description: 'Approve, reject, or flag uploaded media',
  },
  {
    key: 'promotion.approve',
    module: 'advertising',
    description: 'Approve a submitted advertisement request',
  },
  {
    key: 'promotion.mark_paid',
    module: 'advertising',
    description: 'Manually mark an advertisement as paid',
  },
  {
    key: 'user.suspend',
    module: 'users',
    description: 'Suspend a user account',
  },
  {
    key: 'role.manage',
    module: 'admin',
    description: 'Create/edit roles and their permissions',
  },
  {
    key: 'role.assign',
    module: 'admin',
    description: 'Assign a role to a user',
  },
  { key: 'audit.view', module: 'admin', description: 'View audit log entries' },
  {
    key: 'settings.manage',
    module: 'admin',
    description: 'Edit platform configuration',
  },
];

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSIONS.map((permission) => permission.key),
  ADMIN: PERMISSIONS.map((permission) => permission.key).filter(
    (key) => key !== 'role.manage',
  ),
  MODERATOR: [
    'listing.moderate',
    'review.moderate',
    'media.moderate',
    'partner.moderate',
    'promotion.approve',
  ],
  CUSTOMER: [],
};

async function upsertPermissions(connection) {
  if (PERMISSIONS.length === 0) return;
  const placeholders = PERMISSIONS.map(() => '(?, ?, ?)').join(', ');
  const values = PERMISSIONS.flatMap((permission) => [
    permission.key,
    permission.module,
    permission.description,
  ]);
  await connection.query(
    `INSERT INTO permissions (\`key\`, module, description) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE module = VALUES(module), description = VALUES(description)`,
    values,
  );
}

export default async function seedRolesAndPermissions(connection) {
  await upsertByCode(connection, 'roles', ROLES);
  await upsertPermissions(connection);

  const roleIds = await getIdsByCode(
    connection,
    'roles',
    ROLES.map((role) => role.code),
  );
  const [permissionRows] = await connection.query(
    'SELECT id, `key` FROM permissions',
  );
  const permissionIdsByKey = new Map(
    permissionRows.map((row) => [row.key, row.id]),
  );

  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const [roleCode, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    if (permissionKeys.length > 0) {
      const roleId = roleIds.get(roleCode);
      const rows = permissionKeys.map((key) => [
        permissionIdsByKey.get(key),
        roleId,
      ]);
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      await connection.query(
        'INSERT IGNORE INTO permission_role (permission_id, role_id) VALUES ?',
        [rows],
      );
    }
  }
}
