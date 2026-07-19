/**
 * Seeds development admin, vendor (partner), and customer accounts
 * (Sprint 5 §15). Credentials are printed to the log at seed time and
 * documented in docs/SPRINT_5_DATABASE_FOUNDATION.md — every password
 * below is intentionally simple, publicly documented, and MUST NOT be
 * reused anywhere outside a local/sandbox environment. `db:seed` never
 * runs in production (see reset.js's NODE_ENV guard for the equivalent
 * check on the destructive `db:reset` path); this file does not itself
 * re-check NODE_ENV since seeding non-destructively re-creating fixed
 * dev accounts is safe to leave callable, but the credentials being
 * public means this data must never exist outside dev/staging.
 */

import argon2 from 'argon2';
import { getIdByCode } from './helpers.js';

export const DEV_CREDENTIALS = Object.freeze({
  admin: { email: 'admin@travelhub.dev', password: 'DevAdmin!2024' },
  vendor: { email: 'vendor@travelhub.dev', password: 'DevVendor!2024' },
  customer: { email: 'customer@travelhub.dev', password: 'DevCustomer!2024' },
});

async function upsertUser(
  connection,
  { email, password, firstName, lastName, statusId, languageId, currencyId },
) {
  const passwordHash = await argon2.hash(password);
  const normalizedEmail = email.trim().toLowerCase();

  await connection.query(
    `INSERT INTO users
      (email, normalized_email, password_hash, first_name, last_name, status_id,
       is_email_verified, email_verified_at, preferred_language_id, preferred_currency_id)
     VALUES (?, ?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(3), ?, ?)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       status_id = VALUES(status_id)`,
    [
      email,
      normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      statusId,
      languageId,
      currencyId,
    ],
  );

  const [rows] = await connection.query(
    'SELECT id FROM users WHERE normalized_email = ?',
    [normalizedEmail],
  );
  return rows[0].id;
}

async function assignRole(connection, { userId, roleId }) {
  await connection.query(
    'INSERT IGNORE INTO role_user (role_id, user_id) VALUES (?, ?)',
    [roleId, userId],
  );
}

async function upsertPartner(
  connection,
  { legalName, displayName, slug, ownerUserId, statusId },
) {
  await connection.query(
    `INSERT INTO partners
      (legal_name, display_name, slug, verification_status_id, moderation_status_id, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE legal_name = VALUES(legal_name), display_name = VALUES(display_name)`,
    [legalName, displayName, slug, statusId, statusId, ownerUserId],
  );
  const [rows] = await connection.query(
    'SELECT id FROM partners WHERE slug = ?',
    [slug],
  );
  return rows[0].id;
}

export default async function seedDevAccounts(connection) {
  const [
    activeStatusId,
    approvedStatusId,
    superAdminRoleId,
    customerRoleId,
    ownerRoleId,
    enLanguageId,
    amdCurrencyId,
  ] = await Promise.all([
    getIdByCode(connection, 'user_statuses', 'ACTIVE'),
    getIdByCode(connection, 'moderation_statuses', 'APPROVED'),
    getIdByCode(connection, 'roles', 'SUPER_ADMIN'),
    getIdByCode(connection, 'roles', 'CUSTOMER'),
    getIdByCode(connection, 'partner_employee_roles', 'OWNER'),
    getIdByCode(connection, 'languages', 'en'),
    getIdByCode(connection, 'currencies', 'AMD'),
  ]);

  const adminUserId = await upsertUser(connection, {
    email: DEV_CREDENTIALS.admin.email,
    password: DEV_CREDENTIALS.admin.password,
    firstName: 'Dev',
    lastName: 'Admin',
    statusId: activeStatusId,
    languageId: enLanguageId,
    currencyId: amdCurrencyId,
  });
  await assignRole(connection, {
    userId: adminUserId,
    roleId: superAdminRoleId,
  });

  const vendorUserId = await upsertUser(connection, {
    email: DEV_CREDENTIALS.vendor.email,
    password: DEV_CREDENTIALS.vendor.password,
    firstName: 'Dev',
    lastName: 'Vendor',
    statusId: activeStatusId,
    languageId: enLanguageId,
    currencyId: amdCurrencyId,
  });
  await assignRole(connection, {
    userId: vendorUserId,
    roleId: customerRoleId,
  });

  const customerUserId = await upsertUser(connection, {
    email: DEV_CREDENTIALS.customer.email,
    password: DEV_CREDENTIALS.customer.password,
    firstName: 'Dev',
    lastName: 'Customer',
    statusId: activeStatusId,
    languageId: enLanguageId,
    currencyId: amdCurrencyId,
  });
  await assignRole(connection, {
    userId: customerUserId,
    roleId: customerRoleId,
  });

  const partnerId = await upsertPartner(connection, {
    legalName: 'Yerevan Boutique Hospitality LLC',
    displayName: 'Yerevan Boutique Hospitality',
    slug: 'yerevan-boutique-hospitality',
    ownerUserId: vendorUserId,
    statusId: approvedStatusId,
  });

  await connection.query(
    'INSERT IGNORE INTO partner_employees (partner_id, user_id, role_id) VALUES (?, ?, ?)',
    [partnerId, vendorUserId, ownerRoleId],
  );

  return { adminUserId, vendorUserId, customerUserId, partnerId };
}
