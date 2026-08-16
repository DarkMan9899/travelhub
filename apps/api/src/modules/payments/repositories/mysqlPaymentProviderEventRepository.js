/**
 * MySQL-backed Payment Provider Event repository (Phase 16). Owns
 * `payment_provider_events` (migration 0024) — the webhook/event dedup +
 * audit table. `UNIQUE(provider_code, provider_event_id)` is the
 * idempotency guarantee: `create()` throws a mapped `ConflictError` on a
 * redelivered event, which `PaymentService` treats as an already-handled
 * no-op, never a duplicate financial operation.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';

function toDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    providerCode: row.provider_code,
    providerEventId: row.provider_event_id,
    eventType: row.event_type,
    normalizedEventType: row.normalized_event_type,
    payload:
      typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    paymentId: row.payment_id,
    processingStatus: row.processing_status,
    processingError: row.processing_error,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
  };
}

export class MySqlPaymentProviderEventRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async create(
    {
      providerCode,
      providerEventId,
      eventType,
      normalizedEventType,
      payload,
      paymentId,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO payment_provider_events
          (provider_code, provider_event_id, event_type, normalized_event_type, payload, payment_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          providerCode,
          providerEventId,
          eventType,
          normalizedEventType ?? null,
          JSON.stringify(payload ?? {}),
          paymentId ?? null,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT * FROM payment_provider_events WHERE id = ? LIMIT 1',
      [id],
    );
    return toDomain(rows[0]);
  }

  async findByProviderEventId(
    providerCode,
    providerEventId,
    connection = this.#pool,
  ) {
    const [rows] = await connection.query(
      'SELECT * FROM payment_provider_events WHERE provider_code = ? AND provider_event_id = ? LIMIT 1',
      [providerCode, providerEventId],
    );
    return toDomain(rows[0]);
  }

  async markProcessed(id, connection = this.#pool) {
    await connection.query(
      `UPDATE payment_provider_events
       SET processing_status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP(3), processing_error = NULL
       WHERE id = ?`,
      [id],
    );
  }

  async markFailed(id, error, connection = this.#pool) {
    await connection.query(
      `UPDATE payment_provider_events
       SET processing_status = 'FAILED', processing_error = ?
       WHERE id = ?`,
      [error, id],
    );
  }

  async listFailed(limit = 50, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT * FROM payment_provider_events
       WHERE processing_status = 'FAILED'
       ORDER BY received_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map(toDomain);
  }
}

export default MySqlPaymentProviderEventRepository;
