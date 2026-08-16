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

/**
 * Reverses `toCursorSortValue` for the next page's query parameter.
 *
 * Binding the normalized string straight back as a query parameter is a
 * real bug, only visible once a search has more than one page of
 * results (never exercised by earlier phases' handful of dev-seeded
 * listings, confirmed during the Phase 11 pre-flight demo-data pass):
 * mysql2 decodes a `DATETIME` column by interpreting its raw wall-clock
 * value in the connection's session `time_zone` (`SYSTEM` by default —
 * i.e. the server OS's local zone, not UTC) and represents it as a JS
 * `Date` (a UTC instant). `toCursorSortValue` above then formats that
 * `Date` back out as a UTC wall-clock string. Passing that UTC string as
 * a literal `DATETIME` parameter compares it against the column's
 * *local-timezone* wall-clock value directly — silently wrong by exactly
 * the session timezone's offset whenever it isn't UTC, so every "load
 * more" page after the first came back empty. Reconstructing a real
 * `Date` object here and binding *that* instead lets mysql2 re-encode it
 * through the same session timezone it used to decode the column,
 * symmetric with the read path.
 */
function fromCursorSortValue(value) {
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
  ) {
    return new Date(`${value.replace(' ', 'T')}Z`);
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
    priceAmount: row.price_amount,
    priceCurrencyCode: row.price_currency_code,
    mediaCount: Number(row.media_count),
    // Phase 12 (Product Polish): read-only aggregate from `reviews` —
    // `null`/0 when a listing has no approved reviews yet.
    ratingAverage:
      row.rating_average !== null ? Number(row.rating_average) : null,
    reviewCount: Number(row.review_count),
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

function toDestinationResultDomain(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
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

const ENUM_DATA_TYPE_CODES = ['ENUM', 'MULTI_ENUM'];

/** One value table per non-enum primitive (§2.3 of the proposal). */
const ATTRIBUTE_VALUE_TABLES = {
  INTEGER: 'listing_attribute_values_integer',
  DECIMAL: 'listing_attribute_values_decimal',
  BOOLEAN: 'listing_attribute_values_boolean',
  STRING: 'listing_attribute_values_string',
  DATE: 'listing_attribute_values_date',
};

/**
 * Groups the flat `filter_definitions` join into the `groups[].definitions[]`
 * shape `GET /search/filters` serves, attaching each definition's options
 * (attribute enum values, or category-scoped amenities) resolved separately
 * by the two lookups above it in `getFilterDefinitions`.
 */
function toFilterGroupsDomain(rows, optionsByAttributeId, amenityOptions) {
  const groupsByCode = new Map();
  rows.forEach((row) => {
    if (!groupsByCode.has(row.group_code)) {
      groupsByCode.set(row.group_code, {
        code: row.group_code,
        sortOrder: row.group_sort_order,
        definitions: [],
      });
    }
    const isEnum = ENUM_DATA_TYPE_CODES.includes(row.data_type_code);
    const options =
      row.value_source === 'AMENITY'
        ? amenityOptions
        : (isEnum && optionsByAttributeId.get(row.attribute_definition_id)) ||
          [];

    groupsByCode.get(row.group_code).definitions.push({
      code: row.filter_code,
      inputType: row.input_type_code,
      valueSource: row.value_source,
      unit: row.filter_unit,
      min: row.validation_min !== null ? Number(row.validation_min) : null,
      max: row.validation_max !== null ? Number(row.validation_max) : null,
      isMultiValued: Boolean(row.is_multi_valued),
      options,
    });
  });
  return Array.from(groupsByCode.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
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
 *   countryId, partnerId, statusCode, onlyPublished, localeId, defaultLocaleId,
 *   amenityIds (number[], AND semantics — must have ALL), attributeFilters
 *   (Array<{attributeDefinitionId, dataTypeCode, optionIds?: number[], min?,
 *   max?}> — ENUM/MULTI_ENUM use `optionIds` with OR semantics within one
 *   attribute; every other type uses `min`/`max` against its typed value
 *   table; different attributes/amenityIds are always AND'd together)
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
    amenityIds,
    attributeFilters,
    availabilityDateFrom,
    availabilityLastNight,
    availabilityQuantity,
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
  if (amenityIds && amenityIds.length > 0) {
    // One EXISTS per id (not a single IN), so multiple ids require the
    // listing to have ALL of them, not ANY — amenityIds is AND semantics.
    amenityIds.forEach((amenityId) => {
      innerConditions.push(
        'EXISTS (SELECT 1 FROM listing_amenity_listing lal WHERE lal.listing_id = l.id AND lal.amenity_id = ?)',
      );
      innerParams.push(amenityId);
    });
  }
  if (attributeFilters && attributeFilters.length > 0) {
    attributeFilters.forEach((filter) => {
      if (ENUM_DATA_TYPE_CODES.includes(filter.dataTypeCode)) {
        const placeholders = filter.optionIds.map(() => '?').join(', ');
        innerConditions.push(
          `EXISTS (SELECT 1 FROM listing_attribute_option lao WHERE lao.listing_id = l.id AND lao.attribute_option_id IN (${placeholders}))`,
        );
        innerParams.push(...filter.optionIds);
        return;
      }
      const table = ATTRIBUTE_VALUE_TABLES[filter.dataTypeCode];
      const subConditions = [
        'av.listing_id = l.id',
        'av.attribute_definition_id = ?',
      ];
      const subParams = [filter.attributeDefinitionId];
      if (filter.min !== undefined) {
        subConditions.push('av.value >= ?');
        subParams.push(filter.min);
      }
      if (filter.max !== undefined) {
        subConditions.push('av.value <= ?');
        subParams.push(filter.max);
      }
      innerConditions.push(
        `EXISTS (SELECT 1 FROM ${table} av WHERE ${subConditions.join(' AND ')})`,
      );
      innerParams.push(...subParams);
    });
  }

  // Real Inventory Engine availability filtering (Phase 17 §Search
  // integration) — shared across every `bookable_unit_types` code, no
  // category branching. `availability_search_dates` is a recursive
  // date-series CTE bound as the FIRST two params in the final `params`
  // array (see below), since its `WITH RECURSIVE` text is prepended
  // before everything else in the assembled SQL string.
  const hasAvailabilityFilter = Boolean(
    availabilityDateFrom && availabilityLastNight,
  );
  if (hasAvailabilityFilter) {
    innerConditions.push(`
      EXISTS (
        SELECT 1 FROM bookable_units bu
        WHERE bu.listing_id = l.id AND bu.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM availability_search_dates sd
          LEFT JOIN availability_calendar ac ON ac.bookable_unit_id = bu.id AND ac.date = sd.d
          LEFT JOIN availability_statuses ast ON ast.id = ac.status_id
          WHERE COALESCE(ast.code, 'AVAILABLE') = 'BLOCKED'
             OR COALESCE(ac.quantity_available, bu.capacity) < ?
        )
      )
    `);
    innerParams.push(availabilityQuantity);
    // Mirrors `MySqlBlackoutRepository`'s established
    // `bookable_unit_id IS NULL` (listing-level veto) convention exactly.
    innerConditions.push(`
      NOT EXISTS (
        SELECT 1 FROM blackout_dates bd
        WHERE bd.listing_id = l.id AND bd.bookable_unit_id IS NULL
          AND bd.date_from <= ? AND bd.date_to >= ?
      )
    `);
    innerParams.push(availabilityLastNight, availabilityDateFrom);
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

  // The recursive CTE's own two params (`dateFrom`, `lastNight`) bind
  // before every other placeholder in the query, since its `WITH
  // RECURSIVE` text is physically the first thing in `innerSql`.
  const availabilityCteParams = hasAvailabilityFilter
    ? [availabilityDateFrom, availabilityLastNight]
    : [];
  const availabilityCtePrefix = hasAvailabilityFilter
    ? `
    WITH RECURSIVE availability_search_dates AS (
      SELECT ? AS d
      UNION ALL
      SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM availability_search_dates WHERE d < ?
    )
  `
    : '';

  const innerSql = `
    ${availabilityCtePrefix}
    SELECT
      l.id, l.partner_id, l.created_at,
      ltype.code AS listing_type_code,
      ls.code AS status_code,
      l.slug,
      COALESCE(lt.title, lt2.title, '') AS title,
      COALESCE(lt.summary, lt2.summary) AS summary,
      loc.city_id, c.name AS city_name, r.country_id,
      m.url AS cover_image_url,
      lp.amount AS price_amount, cur.code AS price_currency_code,
      (SELECT COUNT(*) FROM media gm
         WHERE gm.mediable_type = 'listing' AND gm.mediable_id = l.id AND gm.deleted_at IS NULL
      ) AS media_count,
      (SELECT AVG(rv.rating) FROM reviews rv
         JOIN moderation_statuses rs ON rs.id = rv.status_id
         WHERE rv.listing_id = l.id AND rs.code = 'APPROVED' AND rv.deleted_at IS NULL
      ) AS rating_average,
      (SELECT COUNT(*) FROM reviews rv
         JOIN moderation_statuses rs ON rs.id = rv.status_id
         WHERE rv.listing_id = l.id AND rs.code = 'APPROVED' AND rv.deleted_at IS NULL
      ) AS review_count,
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
    LEFT JOIN listing_pricing lp ON lp.listing_id = l.id
    LEFT JOIN currencies cur ON cur.id = lp.currency_id
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
    outerParams.push(fromCursorSortValue(decoded.sortValue), decoded.id);
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
    ...availabilityCteParams,
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
   * Phase 20 (SEO) — real seeded cities, each with a published-listing
   * count, backing the new destination landing pages. Mirrors
   * `searchCategories`'s exact join/translation-fallback shape for the
   * city equivalent (`cities`/`city_translations` instead of
   * `listing_categories`/`listing_category_translations`).
   */
  async searchDestinations({ localeId, defaultLocaleId }) {
    const [rows] = await this.#pool.query(
      `
      SELECT
        city.id, city.slug, city.latitude, city.longitude,
        COALESCE(ct.name, ct2.name, city.name) AS name,
        COUNT(DISTINCT CASE WHEN ls.code = 'PUBLISHED' AND l.deleted_at IS NULL THEN l.id END) AS listing_count
      FROM cities city
      LEFT JOIN city_translations ct ON ct.city_id = city.id AND ct.language_id = ?
      LEFT JOIN city_translations ct2 ON ct2.city_id = city.id AND ct2.language_id = ?
      LEFT JOIN listing_locations loc ON loc.city_id = city.id
      LEFT JOIN listings l ON l.id = loc.listing_id
      LEFT JOIN listing_statuses ls ON ls.id = l.status_id
      GROUP BY city.id, city.slug, city.latitude, city.longitude, name
      ORDER BY name ASC
      LIMIT 200
      `,
      [localeId, defaultLocaleId],
    );
    return rows.map(toDestinationResultDomain);
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

  /**
   * Resolves a free-text destination string (e.g. "Yerevan") to a real
   * `cities` row — Stage 15.1 (AI Trip Planner)'s grounding step: a
   * destination the AI provider is never trusted to invent a city id for
   * itself. `LIKE` prefix match (not FULLTEXT), the same convention
   * `suggest()` above already uses for short free-text input.
   *
   * @param {string} query
   * @returns {Promise<{id: number, name: string}|null>}
   */
  async findCityByName(query) {
    const [rows] = await this.#pool.query(
      `SELECT id, name FROM cities WHERE name LIKE ? ORDER BY name ASC LIMIT 1`,
      [`${query}%`],
    );
    return rows[0] ?? null;
  }

  /**
   * Resolves `attr_{code}` query keys to their attribute definition id +
   * data type, so `SearchService` can build `attributeFilters` entries
   * without hand-rolling SQL of its own. Unknown codes are simply absent
   * from the returned Map — `SearchService` drops them rather than
   * erroring, the same "narrow, don't leak" tolerance as an unknown
   * `?locale=`.
   *
   * @param {string[]} codes
   * @returns {Promise<Map<string, {id: number, dataTypeCode: string}>>}
   */
  async getAttributeDefinitionsByCode(codes) {
    if (codes.length === 0) {
      return new Map();
    }
    const [rows] = await this.#pool.query(
      `SELECT ad.code, ad.id, adt.code AS data_type_code
       FROM attribute_definitions ad
       JOIN attribute_data_types adt ON adt.id = ad.data_type_id
       WHERE ad.code IN (?)`,
      [codes],
    );
    return new Map(
      rows.map((row) => [
        row.code,
        { id: row.id, dataTypeCode: row.data_type_code },
      ]),
    );
  }

  /**
   * `GET /search/filters`'s metadata query — implements the proposal's §4.1
   * derived resolution rule directly (no bookkeeping "filter applies to
   * category" table to keep in sync): a filter is visible when it's
   * `is_global` (e.g. the amenities filter, whose *options* are still
   * category-scoped below) or its underlying attribute is linked to
   * `categoryId` via `category_attributes`. Without a `categoryId`, only
   * global filters show — attribute-sourced filters (bedrooms, cuisine, ...)
   * are meaningless without a category to scope them to.
   *
   * RANGE/STEPPER bounds come from `attribute_definitions.validation_min/
   * max` (already seeded per attribute) rather than a live MIN/MAX
   * aggregation — the proposal's "live observed bounds" variant is a
   * dedicated-index-era optimization (§7.4: MySQL-direct is the interim),
   * not required for the filters to work correctly today.
   */
  async getFilterDefinitions(categoryId) {
    const conditions = ['fd.is_global = 1'];
    const params = [];
    if (categoryId !== undefined) {
      conditions.push(
        `(fd.value_source = 'ATTRIBUTE' AND ad.id IN (
           SELECT attribute_definition_id FROM category_attributes WHERE category_id = ?
         ))`,
      );
      params.push(categoryId);
    }

    const [rows] = await this.#pool.query(
      `
      SELECT
        fg.code AS group_code, fg.sort_order AS group_sort_order,
        fd.code AS filter_code, fd.sort_order AS filter_sort_order,
        fd.value_source, fd.unit AS filter_unit,
        fit.code AS input_type_code,
        ad.id AS attribute_definition_id, ad.validation_min, ad.validation_max,
        ad.is_multi_valued, adt.code AS data_type_code
      FROM filter_definitions fd
      JOIN filter_groups fg ON fg.id = fd.filter_group_id
      JOIN filter_input_types fit ON fit.id = fd.input_type_id
      LEFT JOIN attribute_definitions ad ON ad.id = fd.attribute_definition_id
      LEFT JOIN attribute_data_types adt ON adt.id = ad.data_type_id
      WHERE ${conditions.join(' OR ')}
      ORDER BY fg.sort_order ASC, fd.sort_order ASC
      `,
      params,
    );

    const enumAttributeIds = rows
      .filter((row) => ENUM_DATA_TYPE_CODES.includes(row.data_type_code))
      .map((row) => row.attribute_definition_id);

    const optionsByAttributeId = new Map();
    if (enumAttributeIds.length > 0) {
      const [optionRows] = await this.#pool.query(
        `SELECT id, attribute_definition_id, code FROM attribute_options
         WHERE attribute_definition_id IN (?) ORDER BY sort_order ASC`,
        [enumAttributeIds],
      );
      optionRows.forEach((option) => {
        if (!optionsByAttributeId.has(option.attribute_definition_id)) {
          optionsByAttributeId.set(option.attribute_definition_id, []);
        }
        optionsByAttributeId
          .get(option.attribute_definition_id)
          .push({ value: option.id, code: option.code });
      });
    }

    let amenityOptions = [];
    const hasAmenityFilter = rows.some((row) => row.value_source === 'AMENITY');
    if (hasAmenityFilter && categoryId !== undefined) {
      const [amenityRows] = await this.#pool.query(
        `SELECT la.id, la.name FROM listing_amenities la
         JOIN amenity_category_applicability aca ON aca.amenity_id = la.id
         WHERE aca.category_id = ?
         ORDER BY la.name ASC`,
        [categoryId],
      );
      amenityOptions = amenityRows.map((row) => ({
        value: row.id,
        code: row.name,
      }));
    }

    return toFilterGroupsDomain(rows, optionsByAttributeId, amenityOptions);
  }
}

export default MySqlSearchRepository;
