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
  bu.max_guests, bu.bed_configuration,
  bu.base_price_amount, bu.base_price_currency_id, cur.code AS base_price_currency_code,
  bu.created_at, bu.updated_at
`;
const FROM_JOINED = `
  FROM bookable_units bu
  JOIN bookable_unit_types but ON but.id = bu.bookable_unit_type_id
  LEFT JOIN currencies cur ON cur.id = bu.base_price_currency_id
`;

/**
 * `mysql2` returns a JSON column already parsed into a JS value for a
 * normal SELECT — but stays defensive (a raw string would mean a driver/
 * config change slipped in) rather than assuming.
 */
function toBedConfiguration(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return JSON.parse(value);
  return value;
}

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
    maxGuests: row.max_guests,
    bedConfiguration: toBedConfiguration(row.bed_configuration),
    basePriceAmount: row.base_price_amount,
    basePriceCurrencyId: row.base_price_currency_id,
    basePriceCurrencyCode: row.base_price_currency_code,
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
      maxGuests,
      bedConfiguration,
      basePriceAmount,
      basePriceCurrencyId,
      createdBy,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO bookable_units
          (listing_id, bookable_unit_type_id, source_table, source_id, capacity,
           time_slot_start, time_slot_end, unit_label, max_guests, bed_configuration,
           base_price_amount, base_price_currency_id, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          listingId,
          bookableUnitTypeId,
          sourceTable,
          sourceId,
          capacity,
          timeSlotStart ?? null,
          timeSlotEnd ?? null,
          unitLabel ?? null,
          maxGuests ?? null,
          bedConfiguration ? JSON.stringify(bedConfiguration) : null,
          basePriceAmount ?? null,
          basePriceCurrencyId ?? null,
          createdBy,
          createdBy,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  /**
   * Partial update — only fields present in `fields` (checked via
   * `!== undefined`, so an explicit `null` genuinely clears a value,
   * matching `availabilityCalendarRepository.update`'s own convention)
   * are written. No-op (a plain `findById`) when nothing was supplied.
   */
  async update(id, fields, connection = this.#pool) {
    const assignments = [];
    const params = [];

    if (fields.unitLabel !== undefined) {
      assignments.push('unit_label = ?');
      params.push(fields.unitLabel);
    }
    if (fields.capacity !== undefined) {
      assignments.push('capacity = ?');
      params.push(fields.capacity);
    }
    if (fields.maxGuests !== undefined) {
      assignments.push('max_guests = ?');
      params.push(fields.maxGuests);
    }
    if (fields.bedConfiguration !== undefined) {
      assignments.push('bed_configuration = ?');
      params.push(
        fields.bedConfiguration === null
          ? null
          : JSON.stringify(fields.bedConfiguration),
      );
    }
    if (fields.basePriceAmount !== undefined) {
      assignments.push('base_price_amount = ?');
      params.push(fields.basePriceAmount);
    }
    if (fields.basePriceCurrencyId !== undefined) {
      assignments.push('base_price_currency_id = ?');
      params.push(fields.basePriceCurrencyId);
    }

    if (assignments.length === 0) return this.findById(id, connection);

    assignments.push('updated_by = ?');
    params.push(fields.updatedBy);
    params.push(id);

    try {
      await connection.query(
        `UPDATE bookable_units SET ${assignments.join(', ')} WHERE id = ?`,
        params,
      );
    } catch (err) {
      throw mapMysqlError(err);
    }
    return this.findById(id, connection);
  }

  async softDelete(id, deletedBy, connection = this.#pool) {
    await connection.query(
      `UPDATE bookable_units SET ${softDeleteAssignment()}, deleted_by = ?, updated_by = ? WHERE id = ?`,
      [deletedBy, deletedBy, id],
    );
  }
}

export default MySqlBookableUnitRepository;
