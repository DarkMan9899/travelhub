/**
 * Seeds Stage 11.9's `system_settings`/`feature_flags` (migration 0020)
 * with a handful of real starter rows so the new Admin Settings page has
 * something genuine to list/edit from the start, not empty tables.
 * `updated_by` is NULL for seed-applied rows (no acting admin at seed
 * time — the column is nullable exactly for this case, per the
 * migration's own comment). Flags start disabled: no consuming code
 * checks any of these yet, a documented Stage 11.9 scope boundary.
 */

const SETTINGS = [
  {
    key: 'site_name',
    value: 'desavii',
    description: 'Public marketplace display name.',
  },
  {
    key: 'support_email',
    value: 'support@desavii.com',
    description: 'Contact address shown on public support/contact pages.',
  },
  {
    key: 'default_page_size',
    value: 20,
    description: 'Default cursor-page size for admin list views.',
  },
];

const FEATURE_FLAGS = [
  {
    code: 'new_search_ui',
    name: 'New search UI',
    description: 'Experimental redesign of the public search results page.',
    isEnabled: false,
  },
  {
    code: 'email_notifications',
    name: 'Email notifications',
    description: 'Send transactional emails for booking status changes.',
    isEnabled: false,
  },
  {
    code: 'maintenance_mode',
    name: 'Maintenance mode',
    description: 'Show a maintenance banner on the public site.',
    isEnabled: false,
  },
];

async function upsertSetting(connection, { key, value, description }) {
  await connection.query(
    `INSERT INTO system_settings (\`key\`, value, description, updated_by)
     VALUES (?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE value = VALUES(value), description = VALUES(description)`,
    [key, JSON.stringify(value), description],
  );
}

async function upsertFeatureFlag(
  connection,
  { code, name, description, isEnabled },
) {
  await connection.query(
    `INSERT INTO feature_flags (code, name, description, is_enabled)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_enabled = VALUES(is_enabled)`,
    [code, name, description, isEnabled ? 1 : 0],
  );
}

export default async function seedSettingsAndFeatureFlags(connection) {
  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const setting of SETTINGS) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await upsertSetting(connection, setting);
  }
  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const flag of FEATURE_FLAGS) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await upsertFeatureFlag(connection, flag);
  }
}
