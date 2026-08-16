/**
 * MySQL implementation of the AuditLogRepository port.
 *
 * Implements BACKEND_ARCHITECTURE.md §21: writes are insert-only — this
 * adapter never updates or deletes an `audit_logs` row. When a caller
 * passes its own transaction connection (see AuditLogger.record), the
 * write commits atomically alongside the state change it describes;
 * otherwise it runs against the shared pool directly.
 *
 * Stage 11.7 Admin Platform adds `list()` — the first read path this
 * table has had (previously write-only). Cursor-paginated, newest first,
 * mirroring every other admin list (`mysqlUserRepository.listAdmin`'s
 * exact pattern): over-fetch by one row via `LIMIT limit + 1`, sort by
 * `id DESC` (monotonic with `created_at`, so no separate sort key is
 * needed for the cursor), left-join `users` for a display name since
 * `actor_id` is nullable (system/scheduled-job actions).
 */

import { getMysqlPool } from '../mysqlPool.js';
import { mapMysqlError } from '../errorMapping.js';
import { decodeCursor, buildPageMeta } from '../pagination.js';
import { AuditLogRepository as AuditLogRepositoryPort } from '../../../core/interfaces/AuditLogRepository.js';

function toDomain(row) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName:
      row.actor_id && (row.first_name || row.last_name)
        ? [row.first_name, row.last_name].filter(Boolean).join(' ')
        : null,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    beforeSnapshot: row.before_snapshot,
    afterSnapshot: row.after_snapshot,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

export class MySqlAuditLogRepository extends AuditLogRepositoryPort {
  #pool;

  constructor(pool = getMysqlPool()) {
    super();
    this.#pool = pool;
  }

  async record(entry, connection = this.#pool) {
    try {
      await connection.query(
        `INSERT INTO audit_logs
          (actor_id, action, target_type, target_id, before_snapshot, after_snapshot, ip_address, user_agent, request_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.actorId,
          entry.action,
          entry.targetType,
          entry.targetId,
          entry.beforeSnapshot === null
            ? null
            : JSON.stringify(entry.beforeSnapshot),
          entry.afterSnapshot === null
            ? null
            : JSON.stringify(entry.afterSnapshot),
          entry.ipAddress,
          entry.userAgent,
          entry.requestId,
        ],
      );
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async list({
    actorId,
    targetType,
    targetId,
    action,
    dateFrom,
    dateTo,
    cursor = null,
    limit = 20,
  } = {}) {
    const conditions = [];
    const params = [];

    if (actorId) {
      conditions.push('al.actor_id = ?');
      params.push(actorId);
    }
    if (targetType) {
      conditions.push('al.target_type = ?');
      params.push(targetType);
    }
    if (targetId) {
      conditions.push('al.target_id = ?');
      params.push(targetId);
    }
    if (action) {
      conditions.push('al.action = ?');
      params.push(action);
    }
    if (dateFrom) {
      conditions.push('al.created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('al.created_at <= ?');
      params.push(dateTo);
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('al.id < ?');
      params.push(decoded.id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await this.#pool.query(
      `SELECT al.id, al.actor_id, u.first_name, u.last_name, al.action,
              al.target_type, al.target_id, al.before_snapshot,
              al.after_snapshot, al.ip_address, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       ${where}
       ORDER BY al.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toDomain), meta };
  }
}

export default MySqlAuditLogRepository;
