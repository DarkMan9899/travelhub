/**
 * MySQL-backed BookableUnit repository.
 *
 * Owns `bookable_units` (Module Catalog #15). `source_table`/`source_id`
 * is the polymorphic pointer migration `0007` reserves for a future
 * per-type inventory row (`hotel_rooms.id`, etc.) — this sprint's own
 * caller (`BookableUnitService.registerUnit`) passes the documented
 * placeholder (`source_table = 'listings'`, `source_id = listing.id`);
 * a future Hotels/Tours module calls the same repository methods with
 * real values, unchanged.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  scopeActive,
  softDeleteAssignment,
} from '../../../infrastructure/database/softDelete.js';

const SELECT_COLUMNS = `
  bu.id, bu.listing_id, bu.bookable_unit_type_id, but.code AS bookable_unit_type_code,
  bu.source_table, bu.source_id, bu.capacity,
  bu.time_slot_start, bu.time_slot_end, bu.unit_label,
  bu.created_at, bu.updated_at
`;
const FROM_JOINED = `
  FROM bookable_units bu
  JOIN bookable_unit_types but ON but.id = bu.bookable_unit_type_id
`;

/** `TIME` columns round-trip through mysql2 as `HH:MM:SS` strings already — trimmed to `HH:MM` for display. */
function toTimeString(value) {
  return value ? String(value).slice(0, 5) : null;
}

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    listingId: row.listing_id,
    bookableUnitTypeId: row.bookable_unit_type_id,
    bookableUnitTypeCode: row.bookable_unit_type_code,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    capacity: row.capacity,
    timeSlotStart: toTimeString(row.time_slot_start),
    timeSlotEnd: toTimeString(row.time_slot_end),
    unitLabel: row.unit_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MySqlBookableUnitRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async findTypeIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM bookable_unit_types WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINED} WHERE bu.id = ? AND ${scopeActive('bu')} LIMIT 1`,
      [id],
    );
    return toDomain(rows[0]);
  }

  async listForListing(listingId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINED} WHERE bu.listing_id = ? AND ${scopeActive('bu')} ORDER BY bu.id ASC`,
      [listingId],
    );
    return rows.map(toDomain);
  }

  /**
   * Idempotency key for `BookableUnitService.registerUnit`'s find-or-create.
   * `unitLabel` is part of the key (compared via `<=>` NULL-safe equality,
   * since most callers pass no label at all) so that registering several
   * distinct time-slot units for the same listing/type — e.g. an
   * Activity's "09:00" and "14:00" departures — never collapses into one
   * unit; each distinct label is its own row.
   */
  async findMatching(
    { listingId, bookableUnitTypeId, sourceTable, sourceId, unitLabel },
    connection = this.#pool,
  ) {
    const [rows] = await connection.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINED}
       WHERE bu.listing_id = ? AND bu.bookable_unit_type_id = ?
         AND bu.source_table = ? AND bu.source_id = ?
         AND bu.unit_label <=> ?
         AND ${scopeActive('bu')}
       LIMIT 1`,
      [listingId, bookableUnitTypeId, sourceTable, sourceId, unitLabel ?? null],
    );
    return toDomain(rows[0]);
  }

  async create(
    {
      listingId,
      bookableUnitTypeId,
      sourceTable,
      sourceId,
      capacity,
      timeSlotStart,
      timeSlotEnd,
      unitLabel,
      createdBy,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO bookable_units
          (listing_id, bookable_unit_type_id, source_table, source_id, capacity,
           time_slot_start, time_slot_end, unit_label, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          listingId,
          bookableUnitTypeId,
          sourceTable,
          sourceId,
          capacity,
          timeSlotStart ?? null,
          timeSlotEnd ?? null,
          unitLabel ?? null,
          createdBy,
          createdBy,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async softDelete(id, deletedBy, connection = this.#pool) {
    await connection.query(
      `UPDATE bookable_units SET ${softDeleteAssignment()}, deleted_by = ?, updated_by = ? WHERE id = ?`,
      [deletedBy, deletedBy, id],
    );
  }
}

export default MySqlBookableUnitRepository;
