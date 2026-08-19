/**
 * `npm run db:reencrypt-connector-configs` — P0.6 (Master Roadmap)
 * one-time data migration: `inventory_connections.config` was plain
 * JSON before this phase; `MySqlInventoryConnectionRepository` now
 * encrypts every new write, but existing rows (including this
 * codebase's own demo/fixture seed data, which writes `config` via raw
 * SQL, bypassing the repository) stay plaintext until rewritten once.
 *
 * Safe to run repeatedly: a row already in the encrypted envelope shape
 * is left untouched (re-encrypting it would just churn its IV for no
 * benefit — `decryptConnectorConfig`/`encryptConnectorConfig` already
 * round-trip correctly either way). Never touches any other column, and
 * never runs migrations/seeds itself — purely a targeted UPDATE over
 * whatever database `config.database.name` currently resolves to (dev,
 * test, or — once wired into a real deploy pipeline — production).
 */

const { default: config } = await import('../../../config/index.js');
const { getModuleLogger } = await import('../../../logging/logger.js');
const { getMysqlPool, closeMysqlPool } = await import('../mysqlPool.js');
const cipher = await import('../../security/connectorCredentialCipher.js');

const log = getModuleLogger('infrastructure:db-reencrypt-connector-configs');

async function main() {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    'SELECT id, config FROM inventory_connections WHERE config IS NOT NULL',
  );

  let reencrypted = 0;
  let alreadyEncrypted = 0;

  for (const row of rows) {
    const parsed =
      typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
    if (parsed && parsed.v === 1 && parsed.iv && parsed.tag && parsed.data) {
      alreadyEncrypted += 1;
      // eslint-disable-next-line no-continue -- clearer than nesting the rest of the loop body
      continue;
    }
    const encrypted = cipher.encryptConnectorConfig(parsed);
    // eslint-disable-next-line no-await-in-loop -- one-time operator-run migration script, not request-path code
    await pool.query(
      'UPDATE inventory_connections SET config = ? WHERE id = ?',
      [encrypted, row.id],
    );
    reencrypted += 1;
  }

  log.info(
    {
      database: config.database.name,
      reencrypted,
      alreadyEncrypted,
      totalRows: rows.length,
    },
    'db:reencrypt-connector-configs complete',
  );
}

try {
  await main();
} catch (err) {
  log.error({ err }, 'db:reencrypt-connector-configs failed');
  process.exitCode = 1;
} finally {
  await closeMysqlPool();
}
