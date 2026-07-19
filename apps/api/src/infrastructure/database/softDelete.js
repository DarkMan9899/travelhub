/**
 * Soft-delete query-fragment helpers.
 *
 * Implements `DATABASE_ARCHITECTURE.md` §7: every business-entity query is
 * scoped to `deleted_at IS NULL` by default; an explicit `includeTrashed`
 * flag (admin "include trashed" views only) is required to see
 * soft-deleted rows. Cascading soft delete across related tables is a
 * Service-layer transaction (`withTransaction`, Ch.40), never
 * `ON DELETE CASCADE` — this module only builds the WHERE/SET fragments,
 * it never decides *when* to cascade.
 *
 * Fragments below interpolate only a caller-supplied table alias
 * (an identifier, never row data) — actual values are always bound via
 * `?` placeholders by the caller, so this stays consistent with the
 * platform's "parameterized queries only" rule (BACKEND_ARCHITECTURE.md §47).
 */

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertValidAlias(alias) {
  if (alias !== '' && !IDENTIFIER.test(alias)) {
    throw new TypeError(
      `"${alias}" is not a valid SQL identifier for use as a table alias.`,
    );
  }
}

/** WHERE-clause fragment scoping a query to non-deleted rows by default. */
export function scopeActive(alias = '', options = {}) {
  const { includeTrashed = false } = options;
  assertValidAlias(alias);
  if (includeTrashed) return '1=1';
  const column = alias ? `${alias}.deleted_at` : 'deleted_at';
  return `${column} IS NULL`;
}

/** SET-clause fragment for a soft-delete UPDATE — pair with `updated_by`/`deleted_by` params. */
export function softDeleteAssignment(alias = '') {
  assertValidAlias(alias);
  const column = alias ? `${alias}.deleted_at` : 'deleted_at';
  return `${column} = UTC_TIMESTAMP(3)`;
}

/** WHERE-clause fragment for restoring a soft-deleted row. */
export function scopeTrashed(alias = '') {
  assertValidAlias(alias);
  const column = alias ? `${alias}.deleted_at` : 'deleted_at';
  return `${column} IS NOT NULL`;
}
