/**
 * Seed helpers — idempotent upsert utilities shared by every seed module.
 *
 * "Idempotent" means safe to run the same seed twice (Sprint 5 §15
 * "deterministic seed data"): an existing row (matched by its natural/
 * unique key) has its non-key columns refreshed rather than a duplicate
 * being inserted or a unique-constraint error thrown.
 */

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertValidIdentifier(name) {
  if (!IDENTIFIER.test(name)) {
    throw new TypeError(`"${name}" is not a valid SQL identifier.`);
  }
}

/**
 * Upserts rows into a lookup table keyed by its unique `code` column.
 * `table` and every key in `extraColumns` are code-controlled constants
 * (never request/user data) validated as plain identifiers before being
 * interpolated — every actual value is still bound via `?` placeholders.
 *
 * @param {import('mysql2/promise').Connection} connection
 * @param {string} table
 * @param {Array<{code: string, name: string, [key: string]: any}>} rows
 * @param {{ extraColumns?: string[] }} [options]
 */
export async function upsertByCode(connection, table, rows, options = {}) {
  const { extraColumns = [] } = options;
  if (rows.length === 0) return;

  assertValidIdentifier(table);
  extraColumns.forEach(assertValidIdentifier);

  const columns = ['code', 'name', ...extraColumns];
  const placeholders = rows
    .map(() => `(${columns.map(() => '?').join(', ')})`)
    .join(', ');
  const values = rows.flatMap((row) =>
    columns.map((column) => row[column] ?? null),
  );
  const updateClause = columns
    .filter((column) => column !== 'code')
    .map((column) => `${column} = VALUES(${column})`)
    .join(', ');

  await connection.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE ${updateClause}`,
    values,
  );
}

/** Looks up a lookup table's id by its `code` — throws if a prior seed step hasn't run yet. */
export async function getIdByCode(connection, table, code) {
  assertValidIdentifier(table);
  const [rows] = await connection.query(
    `SELECT id FROM ${table} WHERE code = ?`,
    [code],
  );
  if (rows.length === 0) {
    throw new Error(
      `No row in "${table}" with code "${code}" — did an earlier seed step run?`,
    );
  }
  return rows[0].id;
}

/** Bulk variant of getIdByCode — returns a Map<code, id>. */
export async function getIdsByCode(connection, table, codes) {
  assertValidIdentifier(table);
  if (codes.length === 0) return new Map();
  const placeholders = codes.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT id, code FROM ${table} WHERE code IN (${placeholders})`,
    codes,
  );
  const map = new Map(rows.map((row) => [row.code, row.id]));
  const missing = codes.filter((code) => !map.has(code));
  if (missing.length > 0) {
    throw new Error(`Missing "${table}" rows for codes: ${missing.join(', ')}`);
  }
  return map;
}
