/**
 * Cursor-based pagination helper.
 *
 * Implements the `meta.{next_cursor,has_more,limit}` envelope shape from
 * `API_SPECIFICATION.md` §8-9 (already used verbatim by
 * `src/middleware/errorHandler.js` and `src/monitoring/healthRoutes.js`).
 * Cursors are opaque, base64url-encoded JSON of the last row's sort-key
 * values — never a raw numeric offset, so pagination stays stable under
 * concurrent inserts/deletes (a plain `OFFSET` shifts under writes;
 * a keyset cursor does not).
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

/** Malformed/tampered cursors resolve to `null` ("start from the top"), never a 500. */
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(
      Buffer.from(String(cursor), 'base64url').toString('utf8'),
    );
  } catch {
    return null;
  }
}

export function resolveLimit(requestedLimit, options = {}) {
  const { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = options;
  const parsed = Number(requestedLimit);
  if (!Number.isInteger(parsed) || parsed <= 0) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

/**
 * Builds the `{ rows, meta }` page result from a Repository query that
 * intentionally over-fetched by one row (`LIMIT limit + 1`) — the extra
 * row lets `has_more` be determined without a separate `COUNT(*)` query,
 * and is stripped before returning.
 *
 * @param {any[]} rows - up to `limit + 1` rows, already sorted by cursor key
 * @param {number} limit
 * @param {(row: any) => any} getCursorValue - extracts the sort-key value(s) from a row
 */
export function buildPageMeta(rows, limit, getCursorValue) {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  return {
    rows: pageRows,
    meta: {
      next_cursor:
        hasMore && lastRow ? encodeCursor(getCursorValue(lastRow)) : null,
      has_more: hasMore,
      limit,
    },
  };
}

export const PAGINATION_DEFAULTS = Object.freeze({
  DEFAULT_LIMIT,
  MAX_LIMIT,
});
