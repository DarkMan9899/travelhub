/**
 * Seed orchestrator (Sprint 5 §15).
 *
 * Runs every seed module in a fixed, dependency-respecting order inside a
 * single transaction (src/infrastructure/database/transaction.js) — all
 * seed data commits together, or none of it does. Every individual seed
 * module is idempotent (see seeds/helpers.js), so `seedAll()` is safe to
 * run repeatedly against a database that already has this seed data.
 *
 * Usage: node src/infrastructure/database/seeds/index.js
 * (also invoked by `npm run db:seed` and, after a fresh migrate, by
 * `npm run db:reset`.)
 */

import { fileURLToPath } from 'node:url';
import { getMysqlPool, closeMysqlPool } from '../mysqlPool.js';
import { withTransaction } from '../transaction.js';
import { getModuleLogger } from '../../../logging/logger.js';
import seedLookups from './001_lookups.js';
import seedReferenceData from './002_reference_data.js';
import seedTaxonomyAndProducts from './003_taxonomy_and_products.js';
import seedRolesAndPermissions from './004_roles_and_permissions.js';
import seedDevAccounts, { DEV_CREDENTIALS } from './005_dev_accounts.js';

const log = getModuleLogger('infrastructure:seed');

export async function seedAll() {
  const pool = getMysqlPool();
  const accounts = await withTransaction(
    async (connection) => {
      await seedLookups(connection);
      await seedReferenceData(connection);
      await seedTaxonomyAndProducts(connection);
      await seedRolesAndPermissions(connection);
      return seedDevAccounts(connection);
    },
    { pool },
  );

  log.info({ accounts }, 'Seed data applied');
  log.warn(
    { credentials: DEV_CREDENTIALS },
    'Dev-only credentials seeded — publicly documented, never valid in production',
  );
}

async function main() {
  try {
    await seedAll();
  } finally {
    await closeMysqlPool();
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    log.error({ err }, 'Seeding failed');
    process.exitCode = 1;
  });
}

export default seedAll;
