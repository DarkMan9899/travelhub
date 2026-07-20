/**
 * MySQL-backed ReservationHold repository — Sprint 10 (Booking &
 * Reservation Holds Foundation).
 *
 * Owns `reservation_holds`, migrated in 0007 but unused until now.
 * Availability keeps owning this table (same as its other three) even
 * though the `booking-holds` module is its only caller today — mirrors
 * how `BookableUnitService` is a capability Availability owns and a
 * future per-type module calls, never a second table owner.
 *
 * **One row = one unit of capacity**, for one date range, held by one
 * user, until `expires_at`. There is no `quantity` column, so a hold of
 * quantity N is represented as N individual rows created together in one
 * transaction (`createMany`) — the caller's handle for the batch is the
 * literal array of ids `createMany` returns, never a re-derived guess.
 * Releasing/expiring restores capacity by however many of a hold's rows
 * still exist, so partial restoration is exact without needing to
 * remember a number anywhere.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import { toDateString } from '../../../infrastructure/database/dateFormat.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookableUnitId: row.bookable_unit_id,
    userId: row.user_id,
    dateFrom: toDateString(row.start_date),
    dateTo: toDateString(row.end_date),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class MySqlReservationHoldRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  /**
   * Inserts `count` identical rows (one per unit of capacity) in the
   * given range, one `INSERT` at a time within the caller's transaction —
   * safer than relying on multi-row `INSERT`'s auto-increment-continuity
   * guarantee to recover each row's id.
   *
   * @returns {Promise<number[]>} the created rows' ids, in insertion order
   */
  async createMany(
    { bookableUnitId, userId, dateFrom, dateTo, expiresAt, count },
    connection = this.#pool,
  ) {
    const ids = [];
    try {
      for (let i = 0; i < count; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- each insert must observe the previous one under the same transaction/connection.
        const [result] = await connection.query(
          `INSERT INTO reservation_holds
            (bookable_unit_id, user_id, start_date, end_date, expires_at)
           VALUES (?, ?, ?, ?, ?)`,
          [bookableUnitId, userId, dateFrom, dateTo, expiresAt],
        );
        ids.push(result.insertId);
      }
    } catch (err) {
      throw mapMysqlError(err);
    }
    return ids;
  }

  async findByIds(ids, connection = this.#pool) {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `SELECT * FROM reservation_holds WHERE id IN (${placeholders})`,
      ids,
    );
    return rows.map(toDomain);
  }

  /** Ownership- and expiry-scoped — only rows belonging to `userId` and not yet expired. */
  async findActiveByIds(ids, userId, connection = this.#pool) {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `SELECT * FROM reservation_holds
       WHERE id IN (${placeholders}) AND user_id = ? AND expires_at > UTC_TIMESTAMP(3)`,
      [...ids, userId],
    );
    return rows.map(toDomain);
  }

  async listActiveForUser(userId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT * FROM reservation_holds
       WHERE user_id = ? AND expires_at > UTC_TIMESTAMP(3)
       ORDER BY bookable_unit_id ASC, start_date ASC, id ASC`,
      [userId],
    );
    return rows.map(toDomain);
  }

  async deleteByIds(ids, connection = this.#pool) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    await connection.query(
      `DELETE FROM reservation_holds WHERE id IN (${placeholders})`,
      ids,
    );
  }

  /**
   * Expired rows, oldest-unit-first so the sweep job can group and lock
   * one `bookable_unit_id` at a time (`idx_reservation_holds_expires_at`
   * makes the `expires_at` scan cheap; ordering by unit afterward is an
   * in-memory sort of an already-small result set, not a second index).
   */
  async findExpired(limit, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT * FROM reservation_holds
       WHERE expires_at <= UTC_TIMESTAMP(3)
       ORDER BY bookable_unit_id ASC
       LIMIT ?`,
      [limit],
    );
    return rows.map(toDomain);
  }
}

export default MySqlReservationHoldRepository;
