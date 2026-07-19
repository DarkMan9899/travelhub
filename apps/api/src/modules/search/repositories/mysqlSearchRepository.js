/**
 * MySQL-backed Search repository.
 *
 * Implements Sprint 8's Search & Discovery module. Read-only — it queries
 * the accepted Sprint 5/7 schema (`listings` + friends) directly rather
 * than a dedicated search index, which doesn't exist yet (see the Sprint 8
 * plan's "no search-index infrastructure exists" note). Keyword relevance
 * uses the `ft_listing_translations_search` FULLTEXT index already defined
 * on `listing_translations` (migration 0005) — no new index required.
 *
 * `searchListings` wraps its joined query in a derived table so the outer
 * query can filter/order by a computed alias (`relevance_score`, the
 * COALESCE'd display `title`) — MySQL doesn't allow a `WHERE` clause to
 * reference a `SELECT` alias directly, but it can reference a derived
 * table's column freely, since the alias becomes a real column one layer
 * out.
 *
 * In `buildSearchListingsQuery`, every join is either 1:1
 * (`listing_locations`, one cover `media` row) or filtered to equality on
 * the join itself (`listing_translations` scoped to one `language_id`,
 * `listing_category_listing` scoped to one `category_id`), so no row
 * multiplies and no `GROUP BY`/de-duplication is needed there.
 * `searchCategories`, below, deliberately does the opposite — it fans out
 * one row per linked listing specifically so `COUNT(DISTINCT ...)` can
 * collapse it back into a per-category listing count.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { scopeActive } from '../../../infrastructure/database/softDelete.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

/**
 * A `created_at`-sorted cursor's `sortValue` is a `DATETIME(3)` column,
 * which mysql2 returns as a JS `Date`. `encodeCursor`/`decodeCursor`
 * round-trip it through `JSON.stringify`/`JSON.parse`, which turns it into
 * an ISO-8601 string (`...T...Z`) — not the `YYYY-MM-DD HH:MM:SS.fff`
 * format MySQL reliably compares against a `DATETIME` column. Normalizing
 * to that format here (once, at encode time) keeps the decoded cursor
 * value directly bindable in the next page's query.
 */
function toCursorSortValue(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 23).replace('T', ' ');
  }
  return value;
}

function toSearchResultDomain(row) {
  return {
    id: row.id,
    partnerId: row.partner_id,
    listingTypeCode: row.listing_type_code,
    slug: row.slug,
    statusCode: row.status_code,
    title: row.title,
    summary: row.summary,
    cityId: row.city_id,
    cityName: row.city_name,
    countryId: row.country_id,
    coverImageUrl: row.cover_image_url,
    createdAt: row.created_at,
  };
}

function toCategoryResultDomain(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    slug: row.slug,
    name: row.name,
    listingCount: Number(row.listing_count),
  };
}

function toSuggestionDomain(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
  };
}

/**
 * Pure SQL/params builder for `searchListings`, extracted so its
 * placeholder/parameter alignment can be unit-tested without a database
 * (`tests/unit/modules/search/mysqlSearchRepository.buildQuery.test.js`) —
 * the single most error-prone part of this file, since MySQL binds `?`
 * placeholders strictly by their left-to-right physical position in the
 * assembled SQL string, not by the order pieces were assembled in code.
 *
 * @param {object} filters - keyword, categoryId, listingTypeCode, cityId,
 *   countryId, partnerId, statusCode, onlyPublished, localeId, defaultLocaleId
 * @param {{key: string, column: string, direction: 'ASC'|'DESC'}} sort
 * @param {{cursor?: string|null, limit?: number}} [paginationOpts]
 * @returns {{sql: string, params: any[], limit: number}}
 */
export function buildSearchListingsQuery(
  filters,
  sort,
  { cursor = null, limit = 20 } = {},
) {
  const {
    keyword,
    categoryId,
    listingTypeCode,
    cityId,
    countryId,
    partnerId,
    statusCode,
    onlyPublished,
    localeId,
    defaultLocaleId,
  } = filters;

  const innerConditions = [scopeActive('l')];
  const innerParams = [];

  if (partnerId !== undefined) {
    innerConditions.push('l.partner_id = ?');
    innerParams.push(partnerId);
  }
  if (listingTypeCode !== undefined) {
    innerConditions.push('ltype.code = ?');
    innerParams.push(listingTypeCode);
  }
  if (statusCode !== undefined) {
    innerConditions.push('ls.code = ?');
    innerParams.push(statusCode);
  } else if (onlyPublished) {
    innerConditions.push("ls.code = 'PUBLISHED'");
  }
  if (cityId !== undefined) {
    innerConditions.push('loc.city_id = ?');
    innerParams.push(cityId);
  }
  if (countryId !== undefined) {
    innerConditions.push('r.country_id = ?');
    innerParams.push(countryId);
  }
  if (categoryId !== undefined) {
    innerConditions.push('lcl.category_id = ?');
    innerParams.push(categoryId);
  }

  const hasKeyword = Boolean(keyword);
  const matchExpression =
    'MATCH(lt.title, lt.description) AGAINST (? IN NATURAL LANGUAGE MODE)';
  const relevanceSelect = hasKeyword
    ? `${matchExpression} AS relevance_score`
    : 'NULL AS relevance_score';
  if (hasKeyword) {
    innerParams.push(keyword);
    innerConditions.push(`${matchExpression} > 0`);
  }
  // Placeholders must be bound in the exact left-to-right physical order
  // they appear in `innerSql`: the SELECT clause's `relevanceSelect`
  // placeholder comes first (it's written before FROM), then the two
  // JOIN ... language_id placeholders, then the WHERE clause's
  // placeholders in `innerConditions` push order (which includes a
  // second copy of `keyword`, for the WHERE's `matchExpression > 0`).
  const selectKeywordParam = hasKeyword ? [keyword] : [];

  const innerSql = `
    SELECT
      l.id, l.partner_id, l.created_at,
      ltype.code AS listing_type_code,
      ls.code AS status_code,
      l.slug,
      COALESCE(lt.title, lt2.title, '') AS title,
      COALESCE(lt.summary, lt2.summary) AS summary,
      loc.city_id, c.name AS city_name, r.country_id,
      m.url AS cover_image_url,
      ${relevanceSelect}
    FROM listings l
    JOIN listing_types ltype ON ltype.id = l.listing_type_id
    JOIN listing_statuses ls ON ls.id = l.status_id
    LEFT JOIN listing_locations loc ON loc.listing_id = l.id
    LEFT JOIN cities c ON c.id = loc.city_id
    LEFT JOIN regions r ON r.id = c.region_id
    LEFT JOIN listing_translations lt ON lt.listing_id = l.id AND lt.language_id = ?
    LEFT JOIN listing_translations lt2 ON lt2.listing_id = l.id AND lt2.language_id = ?
    LEFT JOIN media m ON m.mediable_type = 'listing' AND m.mediable_id = l.id AND m.is_cover = 1 AND m.deleted_at IS NULL
    ${categoryId !== undefined ? 'LEFT JOIN listing_category_listing lcl ON lcl.listing_id = l.id' : ''}
    WHERE ${innerConditions.join(' AND ')}
  `;

  const outerConditions = [];
  const outerParams = [];
  const decoded = decodeCursor(cursor);
  if (decoded && decoded.sortValue !== undefined && decoded.id !== undefined) {
    const operator = sort.direction === 'DESC' ? '<' : '>';
    outerConditions.push(
      `(results.${sort.column}, results.id) ${operator} (?, ?)`,
    );
    outerParams.push(decoded.sortValue, decoded.id);
  }
  const outerWhere =
    outerConditions.length > 0 ? `WHERE ${outerConditions.join(' AND ')}` : '';

  const sql = `
    SELECT * FROM (${innerSql}) AS results
    ${outerWhere}
    ORDER BY results.${sort.column} ${sort.direction}, results.id ${sort.direction}
    LIMIT ?
  `;

  const params = [
    ...selectKeywordParam,
    localeId,
    defaultLocaleId,
    ...innerParams,
    ...outerParams,
    limit + 1,
  ];

  return { sql, params, limit };
}

export class MySqlSearchRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  /**
   * Resolves a requested `?locale=` code (may be absent/unknown) plus the
   * platform default (`languages.is_default`) to their ids, for
   * `SearchService` to scope translation joins with. A narrow, scoped
   * lookup living here rather than in a dedicated localization repository
   * — the same precedent as `MySqlListingRepository.getPartnerVerification`
   * (Sprint 7): no module owns general `languages` lookups yet, and this
   * is the only caller.
   *
   * @param {string} [requestedCode]
   * @returns {Promise<{localeId: number|null, defaultLocaleId: number|null}>}
   */
  async resolveLocaleIds(requestedCode) {
    const [[defaultLanguage]] = await this.#pool.query(
      'SELECT id FROM languages WHERE is_default = 1 LIMIT 1',
    );
    const defaultLocaleId = defaultLanguage?.id ?? null;

    if (!requestedCode) {
      return { localeId: defaultLocaleId, defaultLocaleId };
    }

    const [[requestedLanguage]] = await this.#pool.query(
      'SELECT id FROM languages WHERE code = ? LIMIT 1',
      [requestedCode],
    );
    return {
      localeId: requestedLanguage?.id ?? defaultLocaleId,
      defaultLocaleId,
    };
  }

  /**
   * @param {object} filters - keyword, categoryId, listingTypeCode, cityId,
   *   countryId, partnerId, statusCode, onlyPublished, localeId, defaultLocaleId
   * @param {{key: string, column: string, direction: 'ASC'|'DESC'}} sort -
   *   from `core/domain/sortOptions.js`; `column`/`id` always share
   *   `direction` (see the module header) so keyset pagination stays a
   *   plain tuple comparison.
   * @param {{cursor?: string|null, limit?: number}} paginationOpts
   */
  async searchListings(filters, sort, paginationOpts = {}) {
    const { sql, params, limit } = buildSearchListingsQuery(
      filters,
      sort,
      paginationOpts,
    );
    const [rows] = await this.#pool.query(sql, params);

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      sortValue: toCursorSortValue(row[sort.column]),
      id: row.id,
    }));
    return { rows: pageRows.map(toSearchResultDomain), meta };
  }

  /** Bounded, ungrouped taxonomy (a few dozen rows) — no pagination needed. */
  async searchCategories({ localeId, defaultLocaleId }) {
    const [rows] = await this.#pool.query(
      `
      SELECT
        cat.id, cat.parent_id, cat.slug,
        COALESCE(ct.name, ct2.name, cat.name) AS name,
        COUNT(DISTINCT CASE WHEN ls.code = 'PUBLISHED' AND l.deleted_at IS NULL THEN l.id END) AS listing_count
      FROM listing_categories cat
      LEFT JOIN listing_category_translations ct ON ct.listing_category_id = cat.id AND ct.language_id = ?
      LEFT JOIN listing_category_translations ct2 ON ct2.listing_category_id = cat.id AND ct2.language_id = ?
      LEFT JOIN listing_category_listing lcl ON lcl.category_id = cat.id
      LEFT JOIN listings l ON l.id = lcl.listing_id
      LEFT JOIN listing_statuses ls ON ls.id = l.status_id
      GROUP BY cat.id, cat.parent_id, cat.slug, name
      ORDER BY name ASC
      LIMIT 200
      `,
      [localeId, defaultLocaleId],
    );
    return rows.map(toCategoryResultDomain);
  }

  /**
   * Typeahead suggestions — `LIKE` prefix match, not FULLTEXT (FULLTEXT's
   * minimum-word-length floor drops short prefixes like "ho"), mirroring
   * `GET /cities/search?q=`'s documented convention
   * (`API_SPECIFICATION.md` §36). Published, non-deleted listings only —
   * a public typeahead must never suggest a draft's title.
   */
  async suggest(query, { localeId, defaultLocaleId }, limit = 10) {
    const prefix = `${query}%`;
    const [rows] = await this.#pool.query(
      `
      SELECT DISTINCT l.id, COALESCE(lt.title, lt2.title) AS title, l.slug
      FROM listings l
      JOIN listing_statuses ls ON ls.id = l.status_id AND ls.code = 'PUBLISHED'
      LEFT JOIN listing_translations lt ON lt.listing_id = l.id AND lt.language_id = ?
      LEFT JOIN listing_translations lt2 ON lt2.listing_id = l.id AND lt2.language_id = ?
      WHERE ${scopeActive('l')} AND (lt.title LIKE ? OR lt2.title LIKE ?)
      ORDER BY title ASC
      LIMIT ?
      `,
      [localeId, defaultLocaleId, prefix, prefix, limit],
    );
    return rows.map(toSuggestionDomain);
  }
}

export default MySqlSearchRepository;
