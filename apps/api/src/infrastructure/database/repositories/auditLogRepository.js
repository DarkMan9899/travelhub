/**
 * MySQL implementation of the AuditLogRepository port.
 *
 * Implements BACKEND_ARCHITECTURE.md §21: writes are insert-only — this
 * adapter never updates or deletes an `audit_logs` row. When a caller
 * passes its own transaction connection (see AuditLogger.record), the
 * write commits atomically alongside the state change it describes;
 * otherwise it runs against the shared pool directly.
 */

import { getMysqlPool } from '../mysqlPool.js';
import { mapMysqlError } from '../errorMapping.js';
import { AuditLogRepository as AuditLogRepositoryPort } from '../../../core/interfaces/AuditLogRepository.js';

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
}

export default MySqlAuditLogRepository;
