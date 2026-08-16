/**
 * MySQL-backed InventoryLedger repository (Phase 17 §29).
 *
 * Owns `inventory_ledger` — an append-only, insert-only audit trail of
 * every write to `availability_calendar.quantity_available`, regardless
 * of which source caused it (TravelHub hold/booking, manual block,
 * external reservation, or a future connector sync). Never updated or
 * deleted; this is the "why is this unavailable" answer for Admin/
 * Support/Partner, so it must outlive whatever created the row.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { toDateString } from '../../../infrastructure/database/dateFormat.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookableUnitId: row.bookable_unit_id,
    date: toDateString(row.date),
    sourceType: row.source_type,
    sourceId: row.source_id,
    delta: row.delta,
    quantityBefore: row.quantity_before,
    quantityAfter: row.quantity_after,
    actorUserId: row.actor_user_id,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export class MySqlInventoryLedgerRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  /**
   * @param {{bookableUnitId:number, date:string, sourceType:string, sourceId:?number, delta:number, quantityBefore:number, quantityAfter:number, actorUserId:?number, reason:?string}} entry
   */
  async record(entry, connection = this.#pool) {
    await connection.query(
      `INSERT INTO inventory_ledger
        (bookable_unit_id, \`date\`, source_type, source_id, delta, quantity_before, quantity_after, actor_user_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.bookableUnitId,
        entry.date,
        entry.sourceType,
        entry.sourceId ?? null,
        entry.delta,
        entry.quantityBefore,
        entry.quantityAfter,
        entry.actorUserId ?? null,
        entry.reason ?? null,
      ],
    );
  }

  /** Chronological trail for one unit within a date span — Admin/Partner "why unavailable" view. */
  async listForUnit(bookableUnitId, { from, to }, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT id, bookable_unit_id, \`date\`, source_type, source_id, delta,
              quantity_before, quantity_after, actor_user_id, reason, created_at
       FROM inventory_ledger
       WHERE bookable_unit_id = ? AND \`date\` >= ? AND \`date\` <= ?
       ORDER BY \`date\` ASC, created_at ASC, id ASC`,
      [bookableUnitId, from, to],
    );
    return rows.map(toDomain);
  }
}

export default MySqlInventoryLedgerRepository;
