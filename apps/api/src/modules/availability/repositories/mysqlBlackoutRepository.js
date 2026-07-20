/**
 * MySQL-backed Blackout repository.
 *
 * Owns `blackout_dates` — the **complementary veto layer** over
 * `availability_calendar`, not the primary availability engine
 * (`BOOKING_ENGINE_ARCHITECTURE.md` §11.5: "checked as a hard veto...
 * before the availability algorithms run"). `AvailabilityService` calls
 * this repository (via `BlackoutService`) to fetch active ranges and
 * apply them on top of `availability_calendar` rows — it never treats
 * blackout rows as the calendar itself.
 *
 * Scoped exclusively to `bookable_unit_id IS NULL` (listing-level
 * blocks) for this sprint; unit-level blackout (`bookable_unit_id` set)
 * is schema-ready but not exposed by this sprint's API, since it would
 * only be meaningful once real per-unit inventory exists.
 *
 * `date_from`/`date_to` are MySQL `DATE` columns; mysql2 returns them as
 * JS `Date` objects (UTC midnight). `toDateString` normalizes every read
 * to a plain `YYYY-MM-DD` string once, here.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';
import { toDateString } from '../../../infrastructure/database/dateFormat.js';

function toDomain(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    dateFrom: toDateString(row.date_from),
    dateTo: toDateString(row.date_to),
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

export class MySqlBlackoutRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create(
    { listingId, dateFrom, dateTo, reason, createdBy },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO blackout_dates (listing_id, date_from, date_to, reason, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [listingId, dateFrom, dateTo, reason ?? null, createdBy, createdBy],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT * FROM blackout_dates WHERE id = ? AND bookable_unit_id IS NULL LIMIT 1',
      [id],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async update(id, fields, connection = this.#pool) {
    const columnMap = {
      dateFrom: 'date_from',
      dateTo: 'date_to',
      reason: 'reason',
      updatedBy: 'updated_by',
    };

    const assignments = [];
    const values = [];
    Object.entries(fields).forEach(([key, value]) => {
      const column = columnMap[key];
      if (column && value !== undefined) {
        assignments.push(`${column} = ?`);
        values.push(value);
      }
    });

    if (assignments.length > 0) {
      try {
        await connection.query(
          `UPDATE blackout_dates SET ${assignments.join(', ')} WHERE id = ?`,
          [...values, id],
        );
      } catch (err) {
        throw mapMysqlError(err);
      }
    }
    return this.findById(id, connection);
  }

  /**
   * Genuine hard delete — `blackout_dates` has no soft-delete columns
   * (ephemeral operational data, same treatment as `reservation_holds`).
   */
  async remove(id, connection = this.#pool) {
    await connection.query('DELETE FROM blackout_dates WHERE id = ?', [id]);
  }

  /** Owner/admin management list — cross-listing, includes `reason`. */
  async list(
    filters = {},
    { cursor = null, limit = 20 } = {},
    connection = this.#pool,
  ) {
    const conditions = ['bd.bookable_unit_id IS NULL'];
    const params = [];

    if (filters.listingId !== undefined) {
      conditions.push('bd.listing_id = ?');
      params.push(filters.listingId);
    }
    if (filters.partnerId !== undefined) {
      conditions.push('l.partner_id = ?');
      params.push(filters.partnerId);
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('bd.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await connection.query(
      `SELECT bd.* FROM blackout_dates bd
       JOIN listings l ON l.id = bd.listing_id AND l.deleted_at IS NULL
       WHERE ${conditions.join(' AND ')}
       ORDER BY bd.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toDomain), meta };
  }

  /**
   * Inclusive-range overlap: two ranges `[a,b]`/`[c,d]` overlap iff
   * `a <= d AND c <= b`. A duplicate range is just a special case of an
   * overlap (identical bounds), so this one check covers both validation
   * rules the Sprint 9 brief asks for.
   */
  async hasOverlap(
    listingId,
    dateFrom,
    dateTo,
    excludeId = null,
    connection = this.#pool,
  ) {
    const conditions = [
      'listing_id = ?',
      'bookable_unit_id IS NULL',
      'date_from <= ?',
      'date_to >= ?',
    ];
    const params = [listingId, dateTo, dateFrom];
    if (excludeId !== null) {
      conditions.push('id != ?');
      params.push(excludeId);
    }
    const [rows] = await connection.query(
      `SELECT id FROM blackout_dates WHERE ${conditions.join(' AND ')} LIMIT 1`,
      params,
    );
    return rows.length > 0;
  }

  /** Blackout ranges overlapping `[from, to]`, for calendar computation. */
  async listForListing(listingId, { from, to }, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT * FROM blackout_dates
       WHERE listing_id = ? AND bookable_unit_id IS NULL AND date_from <= ? AND date_to >= ?
       ORDER BY date_from ASC`,
      [listingId, to, from],
    );
    return rows.map(toDomain);
  }
}

export default MySqlBlackoutRepository;
