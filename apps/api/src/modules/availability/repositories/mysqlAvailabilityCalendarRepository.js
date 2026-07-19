/**
 * MySQL-backed AvailabilityCalendar repository.
 *
 * Owns `availability_calendar` (Module Catalog #15) — one row per
 * bookable unit per date, the platform's single most frequent
 * availability read/write. This sprint's write path only ever persists
 * `AVAILABLE`/`BLOCKED` status rows (enforced in `AvailabilityService`,
 * not here — a Repository never re-validates business rules); `BOOKED`/
 * `HELD` stay reserved for the future Booking Engine. No soft-delete
 * column exists on this table — removing a row is a genuine hard delete,
 * reverting that date to the implicit default of `AVAILABLE`.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toDateString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookableUnitId: row.bookable_unit_id,
    date: toDateString(row.date),
    statusId: row.status_id,
    statusCode: row.status_code,
    quantityAvailable: row.quantity_available,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `
  ac.id, ac.bookable_unit_id, ac.date, ac.status_id, ast.code AS status_code,
  ac.quantity_available, ac.created_at, ac.updated_at
`;
const FROM_JOINED = `
  FROM availability_calendar ac
  JOIN availability_statuses ast ON ast.id = ac.status_id
`;

export class MySqlAvailabilityCalendarRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async findStatusIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM availability_statuses WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINED} WHERE ac.id = ? LIMIT 1`,
      [id],
    );
    return toDomain(rows[0]);
  }

  /**
   * One `INSERT ... ON DUPLICATE KEY UPDATE` per date in `dates`, using
   * the existing `UNIQUE(bookable_unit_id, date)` — a true upsert, so
   * re-writing an already-blocked date is idempotent rather than a
   * duplicate-key error.
   */
  async upsertRange(
    { bookableUnitId, dates, statusId, quantityAvailable },
    connection = this.#pool,
  ) {
    const values = dates.map((date) => [
      bookableUnitId,
      date,
      statusId,
      quantityAvailable ?? null,
    ]);
    try {
      await connection.query(
        `INSERT INTO availability_calendar (bookable_unit_id, \`date\`, status_id, quantity_available)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           status_id = VALUES(status_id), quantity_available = VALUES(quantity_available)`,
        [values],
      );
    } catch (err) {
      throw mapMysqlError(err);
    }
    return this.listForUnit(
      bookableUnitId,
      { from: dates[0], to: dates[dates.length - 1] },
      connection,
    );
  }

  async update(id, fields, connection = this.#pool) {
    const assignments = [];
    const values = [];
    if (fields.statusId !== undefined) {
      assignments.push('status_id = ?');
      values.push(fields.statusId);
    }
    if (fields.quantityAvailable !== undefined) {
      assignments.push('quantity_available = ?');
      values.push(fields.quantityAvailable);
    }

    if (assignments.length > 0) {
      try {
        await connection.query(
          `UPDATE availability_calendar SET ${assignments.join(', ')} WHERE id = ?`,
          [...values, id],
        );
      } catch (err) {
        throw mapMysqlError(err);
      }
    }
    return this.findById(id, connection);
  }

  async remove(id, connection = this.#pool) {
    await connection.query('DELETE FROM availability_calendar WHERE id = ?', [
      id,
    ]);
  }

  async listForUnit(bookableUnitId, { from, to }, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINED}
       WHERE ac.bookable_unit_id = ? AND ac.date >= ? AND ac.date <= ?
       ORDER BY ac.date ASC`,
      [bookableUnitId, from, to],
    );
    return rows.map(toDomain);
  }

  /** Owner/admin management view — cross-unit/listing, cursor-paginated. */
  async list(
    filters = {},
    { cursor = null, limit = 20 } = {},
    connection = this.#pool,
  ) {
    const conditions = ['1=1'];
    const params = [];

    if (filters.unitId !== undefined) {
      conditions.push('ac.bookable_unit_id = ?');
      params.push(filters.unitId);
    }
    if (filters.listingId !== undefined) {
      conditions.push('bu.listing_id = ?');
      params.push(filters.listingId);
    }
    if (filters.partnerId !== undefined) {
      conditions.push('l.partner_id = ?');
      params.push(filters.partnerId);
    }
    if (filters.from !== undefined) {
      conditions.push('ac.date >= ?');
      params.push(filters.from);
    }
    if (filters.to !== undefined) {
      conditions.push('ac.date <= ?');
      params.push(filters.to);
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('ac.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINED}
       JOIN bookable_units bu ON bu.id = ac.bookable_unit_id AND bu.deleted_at IS NULL
       JOIN listings l ON l.id = bu.listing_id AND l.deleted_at IS NULL
       WHERE ${conditions.join(' AND ')}
       ORDER BY ac.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toDomain), meta };
  }
}

export default MySqlAvailabilityCalendarRepository;
